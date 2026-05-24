import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { isOpenViolation, isRecent } from "../../../lib/violation-filters";
import { calculateHabitableScore, type HabitableScoreResult } from "../../../lib/habitable-score";
import type { PropertyResponse } from "../../../lib/property-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

// Caps to keep the request within serverless time limits.
const MAX_REGISTRATION_IDS = 2000;
const TESW_CHUNK = 100;
const PROPERTIES_IN_CHUNK = 200;
const MAX_ENRICHED_BUILDINGS = 120;
const ENRICH_CONCURRENCY = 8;

interface BuildingEntry {
  bbl: string;
  address: string;
  borough: string;
  zip: string;
  has_cached_data: boolean;
  open_violations: number | null;
  complaints: number | null;
  habitable_score: HabitableScoreResult | null;
}

function classifyRole(type: string | null | undefined): "owner" | "manager" | null {
  if (!type) return null;
  const t = type.toLowerCase();
  // CorporateOwner, IndividualOwner, JointOwner
  if (t.includes("owner")) return "owner";
  // HPD uses "Agent" for the managing agent; accept the nominal label too
  if (t === "agent" || t === "managingagent") return "manager";
  // HeadOfficer, SiteManager, Officer, Shareholder, etc. are ignored
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const group of chunk(items, limit)) {
    results.push(...(await Promise.all(group.map(fn))));
  }
  return results;
}

async function readColsByBbl(table: string, bbl: string, cols: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const batchSize = 1000;
  let offset = 0;
  while (true) {
    const { data: batch, error } = await supabaseAdmin
      .from(table)
      .select(cols)
      .eq("bbl", bbl)
      .range(offset, offset + batchSize - 1);
    if (error || !batch || batch.length === 0) break;
    all.push(...(batch as unknown as Record<string, unknown>[]));
    if (batch.length < batchSize) break;
    offset += batchSize;
  }
  return all;
}

async function enrichBuilding(bbl: string): Promise<{
  open_violations: number;
  complaints: number;
  habitable_score: HabitableScoreResult;
}> {
  const [violations, complaints, litigations, bedbugs, buildingDetails, aep] = await Promise.all([
    readColsByBbl("violations", bbl, "class,status,inspectiondate"),
    readColsByBbl("complaints", bbl, "complaint_id,complaint_status,received_date"),
    readColsByBbl("litigations", bbl, "caseopendate"),
    readColsByBbl("bedbug_reports", bbl, "infested_unit_count,filing_date"),
    supabaseAdmin.from("building_details").select("legal_class_a").eq("bbl", bbl).maybeSingle(),
    supabaseAdmin.from("aep_status").select("current_status").eq("bbl", bbl),
  ]);

  // Count only the last 2 years, matching the property page's default view.
  const openViolations = violations.filter(
    (v) => isOpenViolation(v.status as string | null) && isRecent(v.inspectiondate as string | null)
  ).length;
  const complaintCount = new Set(
    complaints
      .filter((c) => isRecent(c.received_date as string | null))
      .map((c) => c.complaint_id)
      .filter(Boolean)
  ).size;

  // Build a minimal PropertyResponse so we can reuse the canonical scoring logic.
  const pseudoProperty = {
    bbl,
    violations,
    complaints,
    litigations,
    bedbug_reports: bedbugs,
    aep_status: aep.data ?? [],
    building_details: buildingDetails.data ? { legal_class_a: buildingDetails.data.legal_class_a } : null,
  } as unknown as PropertyResponse;

  const habitableScore = calculateHabitableScore(pseudoProperty, "recent");

  return { open_violations: openViolations, complaints: complaintCount, habitable_score: habitableScore };
}

function emptyResponse(name: string) {
  return NextResponse.json({
    entity_name: name,
    buildings_as_owner: [],
    buildings_as_manager: [],
    total_buildings: 0,
  });
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "name parameter is required." }, { status: 400 });
  }

  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN || "";
  const tokenParam = appToken ? `&$$app_token=${appToken}` : "";

  try {
    // A) Find all registration contacts for this corporation name (case-insensitive, exact).
    const escapedName = name.replace(/'/g, "''").toUpperCase();
    const where = `upper(corporationname)='${escapedName}'`;
    const contactsUrl =
      `https://data.cityofnewyork.us/resource/feu5-w2e2.json` +
      `?$where=${encodeURIComponent(where)}` +
      `&$select=registrationid,type` +
      `&$limit=50000${tokenParam}`;

    let contacts: { registrationid?: string; type?: string }[];
    try {
      const res = await fetch(contactsUrl);
      if (!res.ok) throw new Error(`HPD Registration Contacts API returned ${res.status}`);
      contacts = await res.json();
    } catch (error) {
      console.error("Portfolio contacts fetch error:", error);
      return NextResponse.json(
        { error: "Could not reach HPD registration data. Please try again." },
        { status: 502 }
      );
    }

    if (contacts.length === 0) return emptyResponse(name);

    // Map each registration id to the role(s) this entity plays on it.
    const regRoles = new Map<string, Set<"owner" | "manager">>();
    for (const c of contacts) {
      const role = classifyRole(c.type);
      if (!role || !c.registrationid) continue;
      if (!regRoles.has(c.registrationid)) regRoles.set(c.registrationid, new Set());
      regRoles.get(c.registrationid)!.add(role);
    }

    const regIds = Array.from(regRoles.keys()).slice(0, MAX_REGISTRATION_IDS);
    if (regIds.length === 0) return emptyResponse(name);

    // B) Resolve registration ids to building rows (batched OR queries, run in parallel).
    const regChunks = chunk(regIds, TESW_CHUNK);
    const regResults = await Promise.all(
      regChunks.map(async (ids) => {
        const orClause = ids.map((id) => `registrationid='${id}'`).join(" OR ");
        const url =
          `https://data.cityofnewyork.us/resource/tesw-yqqr.json` +
          `?$where=${encodeURIComponent(orClause)}` +
          `&$select=registrationid,boroid,block,lot,housenumber,streetname,zip` +
          `&$limit=5000${tokenParam}`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HPD Registration API returned ${res.status}`);
          return (await res.json()) as Record<string, string>[];
        } catch (error) {
          console.error("Portfolio registration fetch error:", error);
          return [];
        }
      })
    );

    // Collapse registration rows into unique buildings (a BBL re-registers yearly).
    const bblInfo = new Map<string, { address: string; borough: string; zip: string; roles: Set<"owner" | "manager"> }>();
    for (const rows of regResults) {
      for (const r of rows) {
        if (!r.boroid || !r.block || !r.lot) continue;
        const bbl = `${r.boroid}${String(r.block).padStart(5, "0")}${String(r.lot).padStart(4, "0")}`;
        const borough = BOROUGH_NAMES[r.boroid] || "";
        const addressParts = [r.housenumber, r.streetname].filter(Boolean).join(" ").trim();
        const address = addressParts || `${borough || "NYC"} (BBL ${bbl})`;
        const roles = regRoles.get(r.registrationid) ?? new Set<"owner" | "manager">();

        const existing = bblInfo.get(bbl);
        if (existing) {
          roles.forEach((role) => existing.roles.add(role));
          if (existing.address.includes("(BBL ") && addressParts) existing.address = address;
          if (!existing.zip && r.zip) existing.zip = r.zip;
        } else {
          bblInfo.set(bbl, { address, borough, zip: r.zip || "", roles: new Set(roles) });
        }
      }
    }

    const allBbls = Array.from(bblInfo.keys());
    if (allBbls.length === 0) return emptyResponse(name);

    // C) Determine which buildings we have cached data for.
    const cachedSet = new Set<string>();
    for (const ids of chunk(allBbls, PROPERTIES_IN_CHUNK)) {
      const { data } = await supabaseAdmin.from("properties").select("bbl").in("bbl", ids);
      (data ?? []).forEach((p: { bbl: string }) => cachedSet.add(p.bbl));
    }

    // Enrich cached buildings with counts and score (bounded for performance).
    const cachedBbls = allBbls.filter((b) => cachedSet.has(b)).slice(0, MAX_ENRICHED_BUILDINGS);
    const enrichment = new Map<string, { open_violations: number; complaints: number; habitable_score: HabitableScoreResult }>();
    await mapWithConcurrency(cachedBbls, ENRICH_CONCURRENCY, async (bbl) => {
      try {
        enrichment.set(bbl, await enrichBuilding(bbl));
      } catch (error) {
        console.error(`Portfolio enrichment error for ${bbl}:`, error);
      }
    });

    // D) Build the grouped response.
    const buildEntry = (bbl: string): BuildingEntry => {
      const info = bblInfo.get(bbl)!;
      const enriched = enrichment.get(bbl);
      return {
        bbl,
        address: info.address,
        borough: info.borough,
        zip: info.zip,
        has_cached_data: cachedSet.has(bbl),
        open_violations: enriched ? enriched.open_violations : null,
        complaints: enriched ? enriched.complaints : null,
        habitable_score: enriched ? enriched.habitable_score : null,
      };
    };

    const sortEntries = (a: BuildingEntry, b: BuildingEntry) => {
      if (a.has_cached_data !== b.has_cached_data) return a.has_cached_data ? -1 : 1;
      const av = a.open_violations ?? -1;
      const bv = b.open_violations ?? -1;
      if (av !== bv) return bv - av;
      return a.address.localeCompare(b.address);
    };

    const buildingsAsOwner = allBbls
      .filter((bbl) => bblInfo.get(bbl)!.roles.has("owner"))
      .map(buildEntry)
      .sort(sortEntries);

    const buildingsAsManager = allBbls
      .filter((bbl) => bblInfo.get(bbl)!.roles.has("manager"))
      .map(buildEntry)
      .sort(sortEntries);

    return NextResponse.json({
      entity_name: name,
      buildings_as_owner: buildingsAsOwner,
      buildings_as_manager: buildingsAsManager,
      total_buildings: allBbls.length,
    });
  } catch (error) {
    console.error("Portfolio API error:", error);
    return NextResponse.json({ error: "Failed to load portfolio data." }, { status: 500 });
  }
}
