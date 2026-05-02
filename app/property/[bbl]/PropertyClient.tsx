"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AddressAutocomplete from "../../components/AddressAutocomplete";
import FuzzyMatchBanner from "../../components/FuzzyMatchBanner";
import { detectFuzzyMatchFromLabel } from "../../../lib/address-matching";
import {
  mapViolation,
  CLASS_INFO,
  type MappedViolation,
} from "../../../lib/violation-mappings";
import type {
  Violation,
  Complaint,
  Litigation,
  BedbugReport,
  ServiceRequest311,
  LeadViolation,
  WorkOrder,
  PropertyResponse,
} from "../../../lib/property-types";
import { SHOW_HABITABLE_SCORE } from "../../../lib/habitable-score";
import { isOpenViolation, isRecent, TWO_YEARS_MS } from "../../../lib/violation-filters";

// ─── Helpers ────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const twoYearsAgo = new Date(Date.now() - TWO_YEARS_MS);
const twoYearsAgoLabel = twoYearsAgo.toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});

// Statuses that are NOT open violations (closed, resolved, or dismissed)
// Status filters imported from lib/violation-filters.ts

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getTopCategories(
  mapped: { mapped: MappedViolation }[]
): { title: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const { mapped: m } of mapped) {
    counts[m.title] = (counts[m.title] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }));
}

function getComplaintCategories(
  complaints: Complaint[]
): { category: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const c of complaints) {
    const cat = c.major_category || "Other";
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));
}

function getLitigationTypes(
  litigations: Litigation[]
): { type: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const l of litigations) {
    const t = l.casetype || "Unknown";
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

interface LandlordQuestion {
  text: string;
  copyText: string;
}

function generateQuestions(
  violations: { violation: Violation; mapped: MappedViolation }[]
): LandlordQuestion[] {
  const questions: LandlordQuestion[] = [];
  const patternCounts: Record<string, number> = {};
  for (const { mapped } of violations) {
    patternCounts[mapped.matchedPattern] =
      (patternCounts[mapped.matchedPattern] || 0) + 1;
  }
  const classC = violations.filter((v) => v.violation.class === "C").length;

  if (patternCounts["no-heat"] || patternCounts["hot-water"]) {
    const count = (patternCounts["no-heat"] || 0) + (patternCounts["hot-water"] || 0);
    questions.push({
      text: `This building has ${count} heat or hot water violation${count === 1 ? "" : "s"}.`,
      copyText: "I noticed this building has heat/hot water violations on file with HPD. Has the boiler been repaired or replaced? What happened last winter?",
    });
  }
  if (patternCounts["water-leak"]) {
    questions.push({
      text: `This building has ${patternCounts["water-leak"]} water leak violation${patternCounts["water-leak"] === 1 ? "" : "s"}.`,
      copyText: "I see there are water leak violations on file with HPD for this building. What is the source of the leaks? Have the pipes been inspected recently?",
    });
  }
  if (patternCounts["vermin-rats"] || patternCounts["vermin-roaches"] || patternCounts["vermin-general"] || patternCounts["bed-bugs"]) {
    const count = (patternCounts["vermin-rats"] || 0) + (patternCounts["vermin-roaches"] || 0) + (patternCounts["vermin-general"] || 0) + (patternCounts["bed-bugs"] || 0);
    questions.push({
      text: `This building has ${count} pest violation${count === 1 ? "" : "s"}.`,
      copyText: "I noticed pest violations on file with HPD for this building. How often does the exterminator come? When was the last treatment?",
    });
  }
  if (patternCounts["lead-paint"]) {
    questions.push({ text: "This building has lead paint violations.", copyText: "I see lead paint violations on file with HPD for this building. Has lead abatement been completed? Can you provide the lead paint disclosure form?" });
  }
  if (patternCounts["mold"]) {
    questions.push({ text: "This building has mold violations.", copyText: "I noticed mold violations on file with HPD. What was the source of moisture? Has professional remediation been done?" });
  }
  if (classC > 5) {
    questions.push({
      text: `This building has ${classC} immediately hazardous (Class C) violations.`,
      copyText: `This building has ${classC} Class C (immediately hazardous) violations on file with HPD. These require correction within 24 hours. Why are these still open? What is the timeline for correction?`,
    });
  }
  return questions.slice(0, 3);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Components ─────────────────────────────────────

function ClassBadge({ cls }: { cls: string }) {
  const info = CLASS_INFO[cls as keyof typeof CLASS_INFO];
  if (!info) return <span className="text-xs text-[var(--muted)]">Class {cls}</span>;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: info.bgColor, color: info.color }}>
      Class {cls} · {info.label}
    </span>
  );
}

function ViolationCard({ violation, mapped }: { violation: Violation; mapped: MappedViolation }) {
  const info = CLASS_INFO[violation.class as keyof typeof CLASS_INFO];
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4" style={{ borderLeftWidth: "3px", borderLeftColor: info?.color || "#555" }}>
      <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug mb-1">{mapped.title}</h3>
      <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">{mapped.explanation}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ClassBadge cls={violation.class} />
        {info && <span className="text-[10px] text-[var(--muted-dim)]">{info.deadline}</span>}
        <span className="text-[10px] text-[var(--muted-dim)]">Inspected {formatDate(violation.inspectiondate)}</span>
      </div>
    </div>
  );
}

function ComplaintCard({ complaint }: { complaint: Complaint }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug">
          {titleCase(complaint.major_category || "Complaint")}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {complaint.complaint_status && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${complaint.complaint_status.toUpperCase() === "OPEN" ? "bg-[#3D2E0A] text-[#FFB020]" : "bg-[var(--card-border)] text-[var(--muted)]"}`}>
              {titleCase(complaint.complaint_status)}
            </span>
          )}
          {complaint.type && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${complaint.type === "EMERGENCY" ? "bg-[#3D1414] text-[#FF4D4D]" : "bg-[var(--card-border)] text-[var(--muted)]"}`}>
              {complaint.type}
            </span>
          )}
        </div>
      </div>
      {complaint.minor_category && (
        <p className="text-xs text-[var(--muted)] mb-1">{titleCase(complaint.minor_category)}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-[var(--muted-dim)]">
        <span>{formatDate(complaint.received_date)}</span>
      </div>
    </div>
  );
}

function LitigationCard({ litigation }: { litigation: Litigation }) {
  const isPending = litigation.casestatus?.toUpperCase() === "PENDING";
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug">
          {titleCase(litigation.casetype || "Case")}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${isPending ? "bg-[#3D2E0A] text-[#FFB020]" : "bg-[var(--card-border)] text-[var(--muted)]"}`}>
          {isPending ? "Pending" : "Closed"}
        </span>
      </div>
      {litigation.respondent && (
        <p className="text-xs text-[var(--muted)] mb-1">{litigation.respondent}</p>
      )}
      <p className="text-[10px] text-[var(--muted-dim)]">Opened {formatDate(litigation.caseopendate)}</p>
    </div>
  );
}

// Pagination component
function ServiceRequestCard({ sr }: { sr: ServiceRequest311 }) {
  const isOpen = sr.status?.toLowerCase() === "open";
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug">
          {sr.complaint_type || "Service Request"}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isOpen ? "bg-[#3D2E0A] text-[#FFB020]" : "bg-[var(--card-border)] text-[var(--muted)]"}`}>
            {isOpen ? "Open" : "Closed"}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--card-border)] text-[var(--muted)]">
            {sr.agency}
          </span>
        </div>
      </div>
      {sr.descriptor && <p className="text-xs text-[var(--muted)] mb-1">{sr.descriptor}</p>}
      <p className="text-[10px] text-[var(--muted-dim)]">{formatDate(sr.created_date)}{sr.agency_name ? ` · ${sr.agency_name}` : ""}</p>
      {sr.resolution_description && (
        <div className="mt-1">
          <p className={`text-[10px] text-[var(--muted-dim)] ${!expanded ? "line-clamp-2" : ""}`}>{sr.resolution_description}</p>
          {sr.resolution_description.length > 120 && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]">{expanded ? "Show less" : "Show more"}</button>
          )}
        </div>
      )}
    </div>
  );
}

function PaginatedList<T>({
  items,
  renderItem,
  keyFn,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyFn: (item: T) => string;
}) {
  const [visible, setVisible] = useState(10);
  const displayed = items.slice(0, visible);
  const remaining = items.length - visible;

  return (
    <div>
      <div className="space-y-2">
        {displayed.map((item) => (
          <div key={keyFn(item)}>{renderItem(item)}</div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          onClick={() => setVisible((v) => v < 20 ? 20 : items.length)}
          className="mt-3 w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {visible < 20 ? "Show next 10" : `Show all ${remaining} remaining`}
        </button>
      )}
    </div>
  );
}

// ─── Collapsible Section ───────────────────────────

function CollapsibleSection({ title, summary, children, defaultOpen = false }: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[var(--background)] transition-colors">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          {summary && !open && <p className="text-[10px] text-[var(--muted-dim)] mt-0.5 truncate">{summary}</p>}
        </div>
        <span className="text-[var(--muted-dim)] ml-2 shrink-0">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-5 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Property Page ──────────────────────────────────

export default function PropertyContent({ bbl }: { bbl: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchedQuery = searchParams.get("q") || "";
  const geoAddress = searchParams.get("address") || "";
  const geoBin = searchParams.get("bin") || "";
  const geoHood = searchParams.get("hood") || "";
  const searchedAddress = searchParams.get("searched") || "";

  const [searchError, setSearchError] = useState("");
  const [addressLabel, setAddressLabel] = useState(geoAddress);
  const [propertyData, setPropertyData] = useState<PropertyResponse | null>(null);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [timeframe, setTimeframe] = useState<"recent" | "all">("recent");
  const [activeTab, setActiveTab] = useState<"violations" | "complaints" | "litigation" | "311">("violations");

  useEffect(() => {
    async function load() {
      setLoadingProperty(true);
      try {
        const params = new URLSearchParams({ bbl });
        if (geoAddress) params.set("address", geoAddress);
        if (geoBin) params.set("bin", geoBin);
        if (geoHood) params.set("hood", geoHood);
        const apiUrl = `/api/property?${params.toString()}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch property data");
        const data: PropertyResponse = await res.json();
        setPropertyData(data);
        if (data.address_label) setAddressLabel(data.address_label);
      } catch { setError("Failed to load property data."); }
      finally { setLoadingProperty(false); }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbl]);

  // Owner portfolio — live lookup
  interface PortfolioBuilding { bbl: string; address: string }
  const [portfolio, setPortfolio] = useState<PortfolioBuilding[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // ACRIS ownership history
  interface DeedRecord { buyer: string; seller: string; date: string; amount: number }
  const [deeds, setDeeds] = useState<DeedRecord[]>([]);
  const [deedsLoading, setDeedsLoading] = useState(true);
  const [showOlderDeeds, setShowOlderDeeds] = useState(false);

  // ACRIS LLC linking
  interface LinkedProperty { bbl: string; address: string; date: string; confirmed: boolean }
  const [linkedProperties, setLinkedProperties] = useState<LinkedProperty[]>([]);
  const [linkedName, setLinkedName] = useState("");

  useEffect(() => {
    if (!propertyData) return;
    const ownerName = (propertyData.registration_contacts ?? []).find((c) => c.type === "CorporateOwner")?.corporation_name;
    if (!ownerName) return;
    // Skip portfolio lookup for condo/co-op buildings
    if (buildingType === "Co-op" || buildingType === "Condo" || buildingType === "Condo / co-op") return;

    async function loadPortfolio() {
      setPortfolioLoading(true);
      try {
        // Find all registrations with same corporate owner
        const contactsRes = await fetch(
          `https://data.cityofnewyork.us/resource/feu5-w2e2.json?corporationname=${encodeURIComponent(ownerName!)}&type=CorporateOwner&$limit=100`
        );
        if (!contactsRes.ok) return;
        const contacts: { registrationid?: string }[] = await contactsRes.json();

        // Get current building's registration ID
        const currentRegId = propertyData!.building_details?.registration_id;
        const allRegIds = contacts.map((c) => c.registrationid).filter((id): id is string => !!id);
        const otherRegIds = Array.from(new Set(allRegIds)).filter((id) => id !== currentRegId);

        if (otherRegIds.length === 0) { setPortfolio([]); return; }

        // Look up building addresses for those registration IDs
        const where = otherRegIds.map((id) => `registrationid='${id}'`).join(" OR ");
        const regRes = await fetch(
          `https://data.cityofnewyork.us/resource/tesw-yqqr.json?$where=${encodeURIComponent(where)}&$select=registrationid,boroid,housenumber,streetname,block,lot&$limit=100`
        );
        if (!regRes.ok) return;
        const regs: { boroid?: string; housenumber?: string; streetname?: string; block?: string; lot?: string }[] = await regRes.json();

        const buildings: PortfolioBuilding[] = regs
          .filter((r) => r.boroid && r.block && r.lot)
          .map((r) => {
            const regBbl = `${r.boroid}${String(r.block).padStart(5, "0")}${String(r.lot).padStart(4, "0")}`;
            const boro = ["", "Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"][parseInt(r.boroid!) || 0] || "";
            return { bbl: regBbl, address: `${r.housenumber} ${r.streetname}, ${boro}` };
          })
          .filter((b) => b.bbl !== bbl);

        // Deduplicate by BBL
        const seen = new Set<string>();
        setPortfolio(buildings.filter((b) => { if (seen.has(b.bbl)) return false; seen.add(b.bbl); return true; }));
      } catch {
        // Silently fail — portfolio is a nice-to-have
      } finally {
        setPortfolioLoading(false);
      }
    }
    loadPortfolio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyData, bbl]);

  // ACRIS deed lookup — async, doesn't block page render
  useEffect(() => {
    if (bbl.length !== 10) { setDeedsLoading(false); return; }
    const borough = bbl[0];
    const block = bbl.slice(1, 6);
    const lot = bbl.slice(6);

    async function loadDeeds() {
      setDeedsLoading(true);
      try {
        // Step 1: Get document IDs for this property
        const lotsRes = await fetch(
          `https://data.cityofnewyork.us/resource/8h5j-fqxa.json?borough=${borough}&block=${block}&lot=${lot}&$limit=200&$order=good_through_date DESC`
        );
        if (!lotsRes.ok) return;
        const lots: { document_id?: string }[] = await lotsRes.json();
        const docIds = Array.from(new Set(lots.map((l) => l.document_id).filter((id): id is string => !!id))).slice(0, 50);
        if (docIds.length === 0) return;

        // Step 2: Find deed documents
        const where = docIds.map((id) => `document_id='${id}'`).join(" OR ");
        const docsRes = await fetch(
          `https://data.cityofnewyork.us/resource/bnx9-e6tj.json?$where=${encodeURIComponent(where)}&$select=document_id,doc_type,document_amt,recorded_datetime&$limit=500`
        );
        if (!docsRes.ok) return;
        const docs: { document_id?: string; doc_type?: string; document_amt?: string; recorded_datetime?: string }[] = await docsRes.json();
        const deedDocs = docs
          .filter((d) => d.doc_type === "DEED" || d.doc_type === "DEEDO")
          .sort((a, b) => (b.recorded_datetime || "").localeCompare(a.recorded_datetime || ""));
        if (deedDocs.length === 0) return;

        // Step 3: Get parties for each deed
        const results: DeedRecord[] = [];
        for (const deed of deedDocs.slice(0, 5)) {
          const partiesRes = await fetch(
            `https://data.cityofnewyork.us/resource/636b-3b5g.json?document_id=${deed.document_id}&$limit=20`
          );
          if (!partiesRes.ok) continue;
          const parties: { party_type?: string; name?: string }[] = await partiesRes.json();
          const sellers = parties.filter((p) => p.party_type === "1").map((p) => p.name).filter(Boolean);
          const buyers = parties.filter((p) => p.party_type === "2").map((p) => p.name).filter(Boolean);
          results.push({
            buyer: buyers.join(", ") || "Unknown",
            seller: sellers.join(", ") || "Unknown",
            date: deed.recorded_datetime || "",
            amount: parseFloat(deed.document_amt || "0") || 0,
          });
        }
        setDeeds(results);
      } catch {
        // Fail silently
      } finally {
        setDeedsLoading(false);
      }
    }
    loadDeeds();
  }, [bbl]);

  // ACRIS LLC linking — find other properties by head officer name
  useEffect(() => {
    if (!propertyData) return;
    const contacts = propertyData.registration_contacts ?? [];
    const person = contacts.find((c) => c.type === "HeadOfficer") || contacts.find((c) => c.type === "IndividualOwner");
    if (!person?.first_name || !person?.last_name) return;
    const first = person.first_name.toUpperCase();
    const last = person.last_name.toUpperCase();
    const nameA = `${last}, ${first}`;
    const nameB = `${first} ${last}`;
    setLinkedName(`${person.first_name} ${person.last_name}`);

    // Get head officer's business zip for address matching
    const hoZip = person.business_address?.match(/\d{5}$/)?.[0] || "";

    async function loadLinked() {
      try {
        // Find all purchases by this person — query both name formats, include address for matching
        const [resA, resB] = await Promise.all([
          fetch(`https://data.cityofnewyork.us/resource/636b-3b5g.json?name=${encodeURIComponent(nameA)}&party_type=2&$limit=50&$select=document_id,zip`),
          fetch(`https://data.cityofnewyork.us/resource/636b-3b5g.json?name=${encodeURIComponent(nameB)}&party_type=2&$limit=50&$select=document_id,zip`),
        ]);
        const partiesA: { document_id?: string; zip?: string }[] = resA.ok ? await resA.json() : [];
        const partiesB: { document_id?: string; zip?: string }[] = resB.ok ? await resB.json() : [];
        const allParties = [...partiesA, ...partiesB];
        // Build zip lookup per document_id
        const partyZipMap = new Map<string, string>();
        for (const p of allParties) {
          if (p.document_id && p.zip) partyZipMap.set(p.document_id, p.zip);
        }
        const docIds = Array.from(new Set(allParties.map((p) => p.document_id).filter((id): id is string => !!id)));
        if (docIds.length === 0) return;

        // Batch lookup property addresses and dates
        const where = docIds.slice(0, 30).map((id) => `document_id='${id}'`).join(" OR ");
        const [legalsRes, masterRes] = await Promise.all([
          fetch(`https://data.cityofnewyork.us/resource/8h5j-fqxa.json?$where=${encodeURIComponent(where)}&$limit=200`),
          fetch(`https://data.cityofnewyork.us/resource/bnx9-e6tj.json?$where=${encodeURIComponent(where)}&$select=document_id,recorded_datetime&$limit=200`),
        ]);
        if (!legalsRes.ok) return;
        const legals: { document_id?: string; borough?: string; block?: string; lot?: string; street_number?: string; street_name?: string }[] = await legalsRes.json();
        const masterDocs: { document_id?: string; recorded_datetime?: string }[] = masterRes.ok ? await masterRes.json() : [];
        const dateMap = new Map(masterDocs.map((d) => [d.document_id, d.recorded_datetime || ""]));

        const boroNames = ["", "Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"];
        const seen = new Set<string>();
        const results: LinkedProperty[] = [];
        const cutoff = "2006-01-01";

        for (const l of legals) {
          if (!l.borough || !l.block || !l.lot) continue;
          const linkedBbl = `${l.borough}${String(l.block).padStart(5, "0")}${String(l.lot).padStart(4, "0")}`;
          if (linkedBbl === bbl || seen.has(linkedBbl)) continue;
          const deedDate = dateMap.get(l.document_id || "") || "";
          // Filter: only last 20 years
          if (deedDate && deedDate < cutoff) continue;
          seen.add(linkedBbl);
          const addr = [l.street_number, l.street_name].filter(Boolean).join(" ");
          const boro = boroNames[parseInt(l.borough) || 0] || "";
          // Address confirmation: match zip codes
          const partyZip = partyZipMap.get(l.document_id || "") || "";
          const confirmed = !!(hoZip && partyZip && hoZip === partyZip);
          results.push({
            bbl: linkedBbl,
            address: addr ? `${addr}, ${boro}` : `${boro} (BBL: ${linkedBbl})`,
            date: deedDate,
            confirmed,
          });
        }

        // Sort: confirmed first, then by date descending
        results.sort((a, b) => (a.confirmed === b.confirmed ? (b.date || "").localeCompare(a.date || "") : a.confirmed ? -1 : 1));
        setLinkedProperties(results.slice(0, 20));
      } catch {
        // Fail silently
      }
    }
    loadLinked();
  }, [propertyData, bbl]);

  function gotoBbl(newBbl: string, q: string, label: string, bin: string, coords: string, hood: string, searched?: string) {
    const params = new URLSearchParams({ q, address: label, bin, coords, hood });
    if (searched) params.set("searched", searched);
    router.push(`/property/${newBbl}?${params.toString()}`);
  }

  async function handleHeaderSubmit({ address: addr }: { address: string }) {
    if (!addr) return;
    if (!/\d/.test(addr)) { setSearchError("Please include a street number"); return; }
    setSearchError("");
    try {
      const query = addr;
      const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;
      if (!foundBbl) { setSearchError("No results found"); return; }
      const label = feature.properties.label || "";
      const foundBin = feature.properties.addendum?.pad?.bin || "";
      const hood = feature.properties.neighbourhood || "";
      const [lng, lat] = feature.geometry?.coordinates || [];
      const coords = lat && lng ? `${lat},${lng}` : "";
      gotoBbl(foundBbl, addr, label, foundBin, coords, hood, addr);
    } catch {
      setSearchError("Something went wrong");
    }
  }

  function handleHeaderSelect(s: { bbl: string; bin: string; name: string; neighbourhood: string; label: string; coords: string }) {
    gotoBbl(s.bbl, s.name, s.label, s.bin, s.coords, s.neighbourhood, s.name);
  }

  // ─── Derived data ───
  // All violations filtered by timeframe (includes all statuses)
  const timeframeViolations = useMemo(() => {
    if (!propertyData) return [];
    if (timeframe === "all") return propertyData.violations;
    return propertyData.violations.filter((v) => isRecent(v.inspectiondate));
  }, [propertyData, timeframe]);

  // Open violations only (excludes closed, dismissed, and pending)
  const filteredViolations = useMemo(() =>
    timeframeViolations.filter((v) => isOpenViolation(v.status)),
    [timeframeViolations]
  );

  // Read pre-computed violation counts from API
  const vCounts = propertyData
    ? (timeframe === "recent" ? propertyData.violation_counts?.recent : propertyData.violation_counts?.all_time)
    : null;
  const actionRequiredCount = vCounts?.require_action ?? 0;


  const sortedViolations = useMemo(() =>
    [...filteredViolations].sort((a, b) => (b.inspectiondate ?? "").localeCompare(a.inspectiondate ?? "")),
    [filteredViolations]
  );

  const mappedViolations = useMemo(() =>
    sortedViolations.map((v) => ({ violation: v, mapped: mapViolation(v.novdescription ?? "") })),
    [sortedViolations]
  );

  // Read pre-computed summary and score from API response (toggle selects timeframe)
  const summary = propertyData
    ? (timeframe === "recent" ? propertyData.assessment_summary_recent : propertyData.assessment_summary_all) ?? null
    : null;

  const topCategories = useMemo(() => getTopCategories(mappedViolations), [mappedViolations]);

  const habitableScore = propertyData?.habitable_score ?? null;

  const filteredComplaints = useMemo(() => {
    if (!propertyData) return [];
    const list = timeframe === "recent"
      ? propertyData.complaints.filter((c) => isRecent(c.received_date))
      : propertyData.complaints;
    return [...list].sort((a, b) => (b.received_date ?? "").localeCompare(a.received_date ?? ""));
  }, [propertyData, timeframe]);

  const complaintCategories = useMemo(() => getComplaintCategories(filteredComplaints), [filteredComplaints]);

  // Read pre-computed complaint counts from API
  const cCounts = propertyData
    ? (timeframe === "recent" ? propertyData.complaint_counts?.recent : propertyData.complaint_counts?.all_time)
    : null;
  const filteredComplaintCount = cCounts?.deduped ?? 0;
  const openComplaintCount = cCounts?.open ?? 0;
  const closedComplaintCount = cCounts?.closed ?? 0;

  const filteredLitigations = useMemo(() => {
    if (!propertyData) return [];
    const list = timeframe === "all"
      ? propertyData.litigations
      : propertyData.litigations.filter((l) => isRecent(l.caseopendate));
    return [...list].sort((a, b) => (b.caseopendate ?? "").localeCompare(a.caseopendate ?? ""));
  }, [propertyData, timeframe]);

  const litigationTypes = useMemo(() => getLitigationTypes(filteredLitigations), [filteredLitigations]);
  const pendingLitigation = useMemo(() => filteredLitigations.filter((l) => l.casestatus?.toUpperCase() === "PENDING").length, [filteredLitigations]);

  const filteredBedbugs = useMemo(() => {
    const all = propertyData?.bedbug_reports ?? [];
    if (all.length === 0) return [] as BedbugReport[];
    const sorted = [...all].sort((a, b) => (b.filing_date ?? "").localeCompare(a.filing_date ?? ""));
    if (timeframe === "all") return sorted;
    return sorted.filter((r) => r.filing_date && new Date(r.filing_date) >= twoYearsAgo);
  }, [propertyData, timeframe]);

  const filtered311 = useMemo(() => {
    const all = propertyData?.service_requests_311 ?? [];
    if (all.length === 0) return [] as ServiceRequest311[];
    const sorted = [...all].sort((a, b) => (b.created_date ?? "").localeCompare(a.created_date ?? ""));
    if (timeframe === "all") return sorted;
    return sorted.filter((r) => isRecent(r.created_date));
  }, [propertyData, timeframe]);

  const agencyBreakdown311 = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filtered311) {
      const a = r.agency || "Other";
      counts[a] = (counts[a] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([agency, count]) => ({ agency, count }));
  }, [filtered311]);



  const filteredLead = useMemo(() => {
    const all = propertyData?.lead_violations ?? [];
    if (all.length === 0) return [] as LeadViolation[];
    const sorted = [...all].sort((a, b) => (b.inspectiondate ?? "").localeCompare(a.inspectiondate ?? ""));
    if (timeframe === "all") return sorted;
    return sorted.filter((v) => isRecent(v.inspectiondate));
  }, [propertyData, timeframe]);

  const openLeadCount = useMemo(() =>
    filteredLead.filter((v) => isOpenViolation(v.status)).length,
    [filteredLead]
  );

  const filteredWorkOrders = useMemo(() => {
    const all = propertyData?.work_orders ?? [];
    if (all.length === 0) return [] as WorkOrder[];
    const sorted = [...all].sort((a, b) => (b.created_date ?? "").localeCompare(a.created_date ?? ""));
    if (timeframe === "all") return sorted;
    return sorted.filter((o) => isRecent(o.created_date));
  }, [propertyData, timeframe]);

  const totalWorkOrderAmount = useMemo(() =>
    filteredWorkOrders.reduce((sum, o) => sum + (o.award_amount || 0), 0),
    [filteredWorkOrders]
  );

  const landlordQuestions = useMemo(() => generateQuestions(mappedViolations), [mappedViolations]);

  const classCount = (cls: string) => {
    if (!vCounts) return 0;
    const key = `class_${cls.toLowerCase()}` as keyof typeof vCounts;
    return (vCounts[key] as number) ?? 0;
  };
  const displayedViolations = mappedViolations.slice(0, visibleCount);
  const timeframeLabel = timeframe === "recent" ? `since ${twoYearsAgoLabel}` : "all time";
  const lCounts = propertyData
    ? (timeframe === "recent" ? propertyData.litigation_counts?.recent : propertyData.litigation_counts?.all_time) ?? 0
    : 0;

  // Registration contacts
  const contacts = useMemo(() => {
    const list = propertyData?.registration_contacts ?? [];
    const byType = (type: string) => list.find((c) => c.type === type);
    return { owner: byType("CorporateOwner"), agent: byType("Agent"), headOfficer: byType("HeadOfficer"), siteManager: byType("SiteManager") };
  }, [propertyData]);

  const buildingDetails = propertyData?.building_details;

  // Building type detection
  const buildingType = useMemo(() => {
    const lot = parseInt(bbl.slice(-4)) || 0;
    const corpName = (contacts.owner?.corporation_name || "").toUpperCase();
    if (corpName.includes("HDFC") || corpName.includes("COOPERATIVE") || /APT(?:ARTMENT)?S?\s+CORP/.test(corpName) || corpName.includes("OWNERS CORP") || corpName.includes("APARTMENT OWNERS") || corpName.includes("TENANTS CORP")) return "Co-op";
    if (corpName.includes("HOA") || corpName.includes("CONDO") || corpName.includes("CONDOMINIUM")) return "Condo";
    if (lot >= 7500) return "Condo / co-op";
    return null;
  }, [bbl, contacts]);

  // Ownership from most recent litigation
  const ownerInfo = useMemo(() => {
    if (!propertyData) return null;
    const sorted = [...propertyData.litigations].sort((a, b) => (b.caseopendate ?? "").localeCompare(a.caseopendate ?? ""));
    return sorted[0]?.respondent || null;
  }, [propertyData]);

  // ─── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)] cursor-pointer" onClick={() => router.push("/")}>Habitable</h1>
          </div>
          <AddressAutocomplete initialAddress={searchedQuery} onSubmit={handleHeaderSubmit} onSelect={handleHeaderSelect} variant="compact" />
          {searchError && <p className="text-xs text-red-400 mt-2">{searchError}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        <FuzzyMatchBanner closestMatch={detectFuzzyMatchFromLabel(searchedAddress, addressLabel) ?? undefined} />
        {loadingProperty && <p className="text-center text-sm text-[var(--muted)] py-12">Loading building data...</p>}
        {error && <div className="rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-400">{error}</div>}

        {propertyData?.fetch_errors && propertyData.fetch_errors.length > 0 && (
          <div className="rounded-xl border border-[#3D2E0A] bg-[#2E2810] px-4 py-3 mb-4 text-sm text-[#FFB020]">
            Some data sources are temporarily unavailable. Results may be incomplete — try again in a few minutes.
          </div>
        )}

        {propertyData && (
          <div className="space-y-5">
            {/* Address header + building info */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">{addressLabel || `Property ${bbl}`}</h2>
                  <p className="text-sm text-[var(--muted-dim)] font-[family-name:var(--font-geist-mono)]">BBL {bbl}</p>
                  {(buildingDetails || propertyData?.nta || buildingType) && (
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {[
                        buildingDetails?.legal_class_a ? `${buildingDetails.legal_class_a} units` : null,
                        buildingDetails?.legal_stories ? `${buildingDetails.legal_stories} stories` : null,
                        propertyData?.nta || null,
                        buildingType,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Link href={`/compare?bbls=${bbl}`} className="shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition-colors">+ Compare</Link>
              </div>
            </div>

            {/* Habitable Score — hidden for AEP buildings */}
            {SHOW_HABITABLE_SCORE && habitableScore && habitableScore.type === "clean" && (
              <div className="rounded-xl border border-green-900 bg-green-950 p-4">
                <p className="text-sm font-semibold text-green-400">{habitableScore.message}</p>
                {timeframe === "all" && (
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">Score reflects last 2 years</p>
                )}
              </div>
            )}
            {SHOW_HABITABLE_SCORE && habitableScore && habitableScore.type === "score" && (
              <div className={`rounded-xl border p-4 ${habitableScore.accentColor === "green" ? "border-green-900 bg-green-950" : habitableScore.accentColor === "amber" ? "border-[#3D2E0A] bg-[#2E2810]" : "border-[#3D1414] bg-[#2E1010]"}`}>
                <p className={`text-lg font-bold ${habitableScore.accentColor === "green" ? "text-green-400" : habitableScore.accentColor === "amber" ? "text-[#FFB020]" : "text-[#FF4D4D]"}`}>
                  Better than {habitableScore.percentile}% of NYC buildings with {habitableScore.bucketLabel} units
                </p>
                <p className="text-[10px] text-[var(--muted-dim)] mt-0.5">Habitable Score</p>
                <p className="text-xs text-[var(--muted-dim)] mt-1">
                  {habitableScore.violationCount ?? 0} open violation{habitableScore.violationCount === 1 ? "" : "s"} ({habitableScore.violPerUnit ?? 0} per unit) · {habitableScore.complaintCount ?? 0} complaint{habitableScore.complaintCount === 1 ? "" : "s"} · Compared against {(habitableScore.peerCount ?? 0).toLocaleString()} buildings
                </p>
                {timeframe === "all" && (
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">Score reflects last 2 years</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <Link href="/methodology" className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]">How this works &rarr;</Link>
                </div>
                <p className="text-[10px] text-[var(--muted-dim)] mt-1">Based on NYC public records. Informational only: verify details before making decisions.</p>
              </div>
            )}
            {SHOW_HABITABLE_SCORE && habitableScore && habitableScore.type === "no_score" && habitableScore.reason === "missing_data" && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs text-[var(--muted)]">Score unavailable — unit count not found in HPD records</p>
                {timeframe === "all" && (
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">Score reflects last 2 years</p>
                )}
              </div>
            )}

            {/* Vacate order banner */}
            {(() => {
              const activeVacate = propertyData.vacate_orders.filter((v) => !v.rescind_date);
              const rescindedVacate = propertyData.vacate_orders.filter((v) => v.rescind_date);
              return (
                <>
                  {activeVacate.length > 0 && (
                    <div className="rounded-xl border-2 border-red-700 bg-red-950 p-5">
                      <p className="text-base font-bold text-red-400 mb-1">Active Vacate Order</p>
                      <p className="text-sm text-red-300">HPD has declared conditions in this building uninhabitable. Reason: {activeVacate[0].reason ?? "Not specified"}</p>
                      {activeVacate[0].effective_date && (
                        <p className="text-xs text-red-400/70 mt-1">Effective {formatDate(activeVacate[0].effective_date)} · {activeVacate[0].units_vacated ?? "?"} units vacated</p>
                      )}
                    </div>
                  )}
                  {activeVacate.length === 0 && rescindedVacate.length > 0 && (
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-3">
                      <p className="text-sm text-[var(--muted)]">
                        A vacate order was previously issued for this building (reason: {rescindedVacate[0].reason ?? "not specified"}, issued {formatDate(rescindedVacate[0].effective_date)}, rescinded {formatDate(rescindedVacate[0].rescind_date)}).
                      </p>
                    </div>
                  )}
                </>
              );
            })()}

            {/* AEP Watchlist Banner */}
            {(() => {
              const aep = propertyData.aep_status ?? [];
              if (aep.length === 0) return null;
              const active = aep.filter((a) => a.current_status === "AEP Active");
              const discharged = aep.filter((a) => a.current_status !== "AEP Active");
              const sortedAep = [...aep].sort((a, b) => (b.aep_start_date ?? "").localeCompare(a.aep_start_date ?? ""));

              return active.length > 0 ? (
                <div className="rounded-xl border-2 border-[#7C2D12] bg-[#431407] p-5">
                  <p className="text-base font-bold text-orange-400 mb-1">HPD Watchlist Building</p>
                  <p className="text-sm text-orange-300">This building is on HPD&apos;s Alternative Enforcement Program, a watchlist for buildings with the most severe and persistent housing code violations. HPD has placed this building under enhanced enforcement and monitoring.</p>
                  {aep.length > 1 && <p className="text-xs text-orange-400/70 mt-1">This building has been placed on HPD&apos;s watchlist {aep.length} times.</p>}
                  <div className="mt-3 space-y-1">
                    {sortedAep.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-orange-300/80">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.current_status === "AEP Active" ? "bg-orange-400" : "bg-[var(--muted-dim)]"}`} />
                        <span>{a.aep_round}</span>
                        <span className="text-orange-400/50">·</span>
                        <span>{formatDate(a.aep_start_date)}{a.discharge_date ? ` — ${formatDate(a.discharge_date)}` : " — present"}</span>
                        {a.violations_at_start && <span className="text-orange-400/50">· {a.violations_at_start} violations at start</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-3">
                  <p className="text-sm text-[var(--muted)]">
                    This building was previously on HPD&apos;s worst-offender watchlist
                    {discharged.length > 0 && ` (discharged ${formatDate(discharged.sort((a, b) => (b.discharge_date ?? "").localeCompare(a.discharge_date ?? ""))[0].discharge_date)})`}.
                    {aep.length > 1 && ` Placed on the watchlist ${aep.length} times.`}
                  </p>
                </div>
              );
            })()}

            {/* Plain-English summary — prominent */}
            {summary && (
              <div className="rounded-xl border-2 bg-[var(--card)] p-6" style={{
                borderColor: summary.severityLevel === "severe" || summary.severityLevel === "serious" ? "#5C1B1B" : summary.severityLevel === "clean" ? "#1B3D1B" : "var(--card-border)",
              }}>
                <h3 className="text-base font-bold text-[var(--foreground)] mb-2">Building Assessment</h3>
                <p className="font-semibold text-[var(--foreground)] text-sm leading-relaxed mb-2">{summary.headline}</p>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{summary.details}</p>
                {topCategories.length > 0 && (
                  <p className="text-xs text-[var(--muted)] leading-relaxed mt-3">
                    Most common {timeframe === "recent" ? "recent " : ""}issues: {topCategories.map((c) => `${c.count} ${c.title.toLowerCase()}`).join(", ")}.
                  </p>
                )}
                {summary.olderNote && timeframe === "recent" && (
                  <p className="text-xs text-[var(--muted-dim)] leading-relaxed mt-2">{summary.olderNote}</p>
                )}
              </div>
            )}

            {/* Questions to ask */}
            {landlordQuestions.length > 0 && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Questions to ask before signing</h3>
                <div className="space-y-3">
                  {landlordQuestions.map((q, i) => (
                    <div key={i} className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
                      <p className="text-xs text-[var(--muted)] mb-2">{q.text}</p>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{q.copyText}</p>
                        <CopyButton text={q.copyText} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Collapsible: Who owns this building? ─── */}
            <CollapsibleSection
              title="Who owns this building?"
              summary={contacts.owner?.corporation_name || ownerInfo || "No registration data"}
            >
              {(contacts.owner || contacts.agent || ownerInfo) && (
                <div className="space-y-1.5">
                  {contacts.owner && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-[var(--muted-dim)] w-20 shrink-0">Owner</span>
                      <span className="text-sm text-[var(--foreground)]">{contacts.owner.corporation_name || [contacts.owner.first_name, contacts.owner.last_name].filter(Boolean).join(" ")}</span>
                    </div>
                  )}
                  {contacts.agent && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-[var(--muted-dim)] w-20 shrink-0">Agent</span>
                      <span className="text-sm text-[var(--foreground)]">
                        {[contacts.agent.first_name, contacts.agent.last_name].filter(Boolean).join(" ")}
                        {contacts.agent.corporation_name && <span className="text-[var(--muted)]">, {contacts.agent.corporation_name}</span>}
                      </span>
                    </div>
                  )}
                  {contacts.headOfficer && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-[var(--muted-dim)] w-20 shrink-0">Head Officer</span>
                      <span className="text-sm text-[var(--foreground)]">{[contacts.headOfficer.first_name, contacts.headOfficer.last_name].filter(Boolean).join(" ")}</span>
                    </div>
                  )}
                  {contacts.siteManager && contacts.siteManager.last_name !== contacts.agent?.last_name && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-[var(--muted-dim)] w-20 shrink-0">Site Manager</span>
                      <span className="text-sm text-[var(--foreground)]">{[contacts.siteManager.first_name, contacts.siteManager.last_name].filter(Boolean).join(" ")}</span>
                    </div>
                  )}
                  {ownerInfo && !contacts.owner && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-[var(--muted-dim)] w-20 shrink-0">Owner</span>
                      <span className="text-sm text-[var(--foreground)]">{ownerInfo}</span>
                    </div>
                  )}
                  {ownerInfo && contacts.owner && (
                    <p className="text-[10px] text-[var(--muted-dim)] mt-1">Also named in HPD litigation: {ownerInfo}</p>
                  )}
                </div>
              )}
              {(() => {
                const ownerName = contacts.owner?.corporation_name;
                if (!ownerName) return null;
                if (buildingType === "Co-op" || buildingType === "Condo" || buildingType === "Condo / co-op") {
                  return <p className="text-xs text-[var(--muted)]">This is a {buildingType.toLowerCase()} building. {ownerName} is the homeowners association. Individual units are owned separately.</p>;
                }
                if (portfolioLoading) return <p className="text-xs text-[var(--muted-dim)]">Looking up owner portfolio...</p>;
                if (portfolio.length === 0) return <p className="text-xs text-[var(--muted)]">No other buildings registered under {ownerName}.</p>;
                return (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-2">{ownerName} also operates {portfolio.length} other building{portfolio.length === 1 ? "" : "s"}:</p>
                    <div className="space-y-1">
                      {portfolio.slice(0, 10).map((b) => (
                        <div key={b.bbl} className="flex items-center justify-between">
                          <Link href={`/property/${b.bbl}`} className="text-xs text-[var(--foreground)] hover:underline truncate">{b.address}</Link>
                          <span className="text-[10px] text-[var(--muted-dim)] ml-2 shrink-0 font-[family-name:var(--font-geist-mono)]">{b.bbl}</span>
                        </div>
                      ))}
                      {portfolio.length > 10 && <p className="text-[10px] text-[var(--muted-dim)]">...and {portfolio.length - 10} more</p>}
                    </div>
                  </div>
                );
              })()}

              {/* ACRIS LLC Linking */}
              {linkedProperties.length > 0 && linkedName && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--muted-dim)] uppercase tracking-wide mb-2">Other properties linked to {linkedName}</h4>
                  <p className="text-xs text-[var(--muted)] mb-2">{linkedName} is also linked to {linkedProperties.length} other property transaction{linkedProperties.length === 1 ? "" : "s"}:</p>
                  <div className="space-y-1">
                    {linkedProperties.map((lp) => (
                      <div key={lp.bbl} className="flex items-center justify-between">
                        <Link href={`/property/${lp.bbl}`} className="text-xs text-[var(--foreground)] hover:underline truncate">
                          {lp.address}
                          {lp.date && <span className="text-[var(--muted-dim)]"> · {formatDate(lp.date)}</span>}
                          {lp.confirmed && <span className="text-[10px] text-green-500 ml-1">✓</span>}
                        </Link>
                        <span className="text-[10px] text-[var(--muted-dim)] ml-2 shrink-0 font-[family-name:var(--font-geist-mono)]">{lp.bbl}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted-dim)] mt-2">Properties linked by owner name match. Results from the last 20 years — older transactions excluded. Some may belong to a different person with the same name.</p>
                </div>
              )}

              {/* Ownership History (ACRIS) */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-dim)] uppercase tracking-wide mb-2">Ownership History</h4>
                {deedsLoading ? (
                  <p className="text-xs text-[var(--muted-dim)]">Loading ownership history...</p>
                ) : deeds.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Ownership history not available from public records.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Most recent deed */}
                    <div>
                      <p className="text-sm text-[var(--foreground)]">
                        <span className="font-medium">{deeds[0].buyer}</span>
                        {" "}purchased this building from{" "}
                        <span className="font-medium">{deeds[0].seller}</span>
                        {" "}on {formatDate(deeds[0].date)}
                        {deeds[0].amount >= 1000
                          ? ` for $${Math.round(deeds[0].amount).toLocaleString()}`
                          : " (transfer — no sale price recorded)"}
                        .
                      </p>
                      {deeds[0].date && (
                        <p className="text-[10px] text-[var(--muted-dim)] mt-0.5">
                          Current owner for {Math.max(0, Math.floor((Date.now() - new Date(deeds[0].date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))} years
                        </p>
                      )}
                    </div>

                    {/* Older deeds */}
                    {deeds.length > 1 && (
                      <div>
                        <button onClick={() => setShowOlderDeeds(!showOlderDeeds)} className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]">
                          {showOlderDeeds ? "Hide" : "Show"} {deeds.length - 1} previous transfer{deeds.length - 1 === 1 ? "" : "s"}
                        </button>
                        {showOlderDeeds && (
                          <div className="mt-2 space-y-1.5">
                            {deeds.slice(1).map((d, i) => (
                              <div key={i} className="text-xs text-[var(--muted)]">
                                {formatDate(d.date)} — {d.buyer} from {d.seller}
                                {d.amount >= 1000 ? ` · $${Math.round(d.amount).toLocaleString()}` : " · Transfer"}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Timeframe toggle */}
            <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-1 border border-[var(--card-border)] w-fit">
              <button onClick={() => { setTimeframe("recent"); setVisibleCount(10); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeframe === "recent" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Last 2 years</button>
              <button onClick={() => { setTimeframe("all"); setVisibleCount(10); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeframe === "all" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>All time</button>
            </div>

            {/* Violation class breakdown */}
            {(vCounts?.total ?? 0) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Current violations</h3>
                <div className="grid grid-cols-5 gap-2">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-center">
                    <p className="text-xl font-bold text-[#FF4D4D]">{actionRequiredCount}</p>
                    <p className="text-[10px] text-[var(--muted-dim)] mt-0.5">Require action</p>
                    <p className="text-[10px] text-[var(--muted-dim)]">{vCounts?.total_open ?? 0} total open</p>
                  </div>
                  {(["C", "B", "A", "I"] as const).map((cls) => {
                    const info = CLASS_INFO[cls];
                    return (
                      <div key={cls} className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-center">
                        <p className="text-xl font-bold" style={{ color: info.color }}>{classCount(cls)}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: info.color }}>Class {cls}</p>
                      </div>
                    );
                  })}
                </div>
                <a href="https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--muted-dim)] hover:text-[var(--muted)] mt-1 inline-block">
                  What do these classes mean?
                </a>
              </div>
            )}

            {/* ─── Collapsible: Tenant complaints & legal action ─── */}
            <CollapsibleSection
              title="Tenant complaints & legal action"
              summary={`${filteredComplaintCount} complaint${filteredComplaintCount === 1 ? "" : "s"} · ${lCounts} litigation`}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-3">
                  <p className="text-xs text-[var(--muted-dim)] mb-0.5">Complaints ({timeframeLabel})</p>
                  <p className="text-lg font-bold text-[var(--foreground)]">{filteredComplaintCount}</p>
                  {filteredComplaintCount > 0 && (
                    <p className="text-[10px] text-[var(--muted-dim)]">
                      {openComplaintCount > 0 && <span className="text-[#FFB020]">{openComplaintCount} open</span>}
                      {openComplaintCount > 0 && closedComplaintCount > 0 && " · "}
                      {closedComplaintCount > 0 && <span>{closedComplaintCount} closed</span>}
                    </p>
                  )}
                  {complaintCategories.length > 0 && (
                    <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                      {complaintCategories.slice(0, 3).map((c) => `${titleCase(c.category)} (${c.count})`).join(", ")}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-3">
                  <p className="text-xs text-[var(--muted-dim)] mb-0.5">Litigation ({timeframeLabel})</p>
                  <p className="text-lg font-bold text-[var(--foreground)]">{lCounts}</p>
                  {lCounts > 0 && (
                    <p className="text-[10px] text-[var(--muted-dim)]">
                      {pendingLitigation > 0 && <span className="text-[#FFB020]">{pendingLitigation} pending</span>}
                      {pendingLitigation > 0 && (lCounts - pendingLitigation) > 0 && " · "}
                      {(lCounts - pendingLitigation) > 0 && <span>{lCounts - pendingLitigation} closed</span>}
                    </p>
                  )}
                  {litigationTypes.length > 0 && (
                    <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                      {litigationTypes.slice(0, 2).map((t) => `${titleCase(t.type)} (${t.count})`).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            {/* ─── Collapsible: Building safety history ─── */}
            <CollapsibleSection
              title="Building safety history"
              summary={[
                openLeadCount > 0 ? `Lead paint: ${openLeadCount} open` : null,
                filteredWorkOrders.length > 0 ? `Emergency repairs: ${filteredWorkOrders.length}` : null,
                filteredBedbugs.length > 0 ? `Bed bug filings: ${filteredBedbugs.length}` : null,
                filtered311.length > 0 ? `311 reports: ${filtered311.length}` : null,
              ].filter(Boolean).join(" · ") || "No additional history"}
            >
              {/* Bed Bug History */}
              {filteredBedbugs.length > 0 && (() => {
                const totalInfested = filteredBedbugs.reduce((s, r) => s + (r.infested_unit_count || 0), 0);
                const totalEradicated = filteredBedbugs.reduce((s, r) => s + (r.eradicated_unit_count || 0), 0);
                const hasActive = filteredBedbugs.some((r) => r.infested_unit_count > 0);
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">Bed Bug History</h4>
                    {hasActive ? (
                      <div className="rounded-lg border border-[#3D2E0A] bg-[#2E2810] px-3 py-2 mb-2"><p className="text-sm text-[#FFB020]">Bed bugs have been reported in this building.</p></div>
                    ) : totalInfested === 0 ? (
                      <p className="text-xs text-[var(--muted)] mb-2">No active infestations.{totalEradicated > 0 && ` ${totalEradicated} unit${totalEradicated === 1 ? "" : "s"} previously treated.`}</p>
                    ) : null}
                    <div className="grid grid-cols-3 gap-3">
                      <div><p className="text-lg font-bold text-[var(--foreground)]">{filteredBedbugs.length}</p><p className="text-[10px] text-[var(--muted-dim)]">Annual filings</p></div>
                      <div><p className="text-lg font-bold text-[var(--foreground)]">{formatDate(filteredBedbugs[0].filing_date)}</p><p className="text-[10px] text-[var(--muted-dim)]">Most recent</p></div>
                      <div><p className="text-lg font-bold text-[var(--foreground)]">{totalEradicated > 0 ? totalEradicated : totalInfested}</p><p className="text-[10px] text-[var(--muted-dim)]">{totalEradicated > 0 ? "Treated" : "Infested"}</p></div>
                    </div>
                  </div>
                );
              })()}

              {/* Lead Paint */}
              {filteredLead.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">Lead Paint Violations</h4>
                  {openLeadCount > 0 ? (
                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">{openLeadCount} open lead paint violation{openLeadCount === 1 ? "" : "s"} — critical for families with children</p>
                  ) : (
                    <p className="text-xs text-[var(--muted)] mb-1">No open lead paint violations. {filteredLead.length} previously resolved.</p>
                  )}
                  <p className="text-[10px] text-[var(--muted-dim)]">{filteredLead.length} total ({timeframeLabel})</p>
                </div>
              )}

              {/* Emergency Work Orders */}
              {filteredWorkOrders.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">Emergency Repairs</h4>
                  <p className="text-xs text-[var(--muted)] mb-1">
                    {filteredWorkOrders.length} repair{filteredWorkOrders.length === 1 ? "" : "s"}
                    {totalWorkOrderAmount > 0 && ` · $${Math.round(totalWorkOrderAmount).toLocaleString()}`}
                  </p>
                  {(() => {
                    const typeCounts: Record<string, number> = {};
                    for (const o of filteredWorkOrders) { typeCounts[o.work_type || "Other"] = (typeCounts[o.work_type || "Other"] || 0) + 1; }
                    const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
                    const labels: Record<string, string> = { GC: "General construction", DELEAD: "Lead removal", PLUMB: "Plumbing", ELEC: "Electrical", HEAT: "Heating", PAINT: "Painting", LOCKSMITH: "Locksmith", ASBEST: "Asbestos removal", ENGINR: "Engineering", CARP: "Carpentry", MASON: "Masonry", ROOF: "Roofing", IRON: "Ironwork", EXTERMIN: "Extermination" };
                    return types.length > 0 ? <p className="text-[10px] text-[var(--muted-dim)]">{types.map(([t, c]) => `${labels[t.toUpperCase()] || titleCase(t)} (${c})`).join(", ")}</p> : null;
                  })()}
                </div>
              )}

              {/* 311 Reports */}
              {filtered311.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">311 Reports</h4>
                  <p className="text-xs text-[var(--muted)]">{filtered311.length} report{filtered311.length === 1 ? "" : "s"} ({timeframeLabel})</p>
                  {agencyBreakdown311.length > 0 && (
                    <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                      {agencyBreakdown311.map((a) => {
                        const names: Record<string, string> = { DOB: "Dept. of Buildings", FDNY: "Fire Dept.", DEP: "Environmental Protection", DOHMH: "Health Dept." };
                        return `${names[a.agency] || a.agency} (${a.count})`;
                      }).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {filteredBedbugs.length === 0 && filteredLead.length === 0 && filteredWorkOrders.length === 0 && filtered311.length === 0 && (
                <p className="text-xs text-[var(--muted)]">No additional building history {timeframe === "recent" ? "in the last 2 years" : "on record"}.</p>
              )}
            </CollapsibleSection>

            {/* ─── Collapsible: All inspection records ─── */}
            <CollapsibleSection
              title="All inspection records"
              summary="View all individual records"
            >
            <div>
              <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-1 border border-[var(--card-border)] w-fit mb-4 flex-wrap">
                {(["violations", "complaints", "litigation", "311"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                    {tab === "violations" ? `Violations (${filteredViolations.length})` : tab === "complaints" ? `Complaints (${filteredComplaintCount})` : tab === "litigation" ? `Litigation (${filteredLitigations.length})` : `311 Reports (${filtered311.length})`}
                  </button>
                ))}
              </div>

              {activeTab === "violations" && (
                filteredViolations.length > 0 ? (
                  <div>
                    <div className="space-y-2">
                      {displayedViolations.map(({ violation, mapped }) => (
                        <ViolationCard key={violation.id} violation={violation} mapped={mapped} />
                      ))}
                    </div>
                    {visibleCount < mappedViolations.length && (
                      <button onClick={() => setVisibleCount((v) => v < 20 ? 20 : mappedViolations.length)} className="mt-3 w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        {visibleCount < 20 ? "Show next 10" : `Show all ${mappedViolations.length - visibleCount} remaining`}
                      </button>
                    )}
                  </div>
                ) : (
                  (() => {
                    const noData = propertyData.violations.length === 0 && propertyData.complaints.length === 0 && propertyData.litigations.length === 0;
                    const bd = buildingDetails;
                    const isCondo = bd && (
                      (bd.dob_building_class || "").toUpperCase().includes("CONDO") ||
                      (bd.dob_building_class || "").toUpperCase().includes("CONDOMINIUM") ||
                      (bd.legal_class_b ?? 0) > 0
                    );

                    if (noData && isCondo) {
                      return (
                        <div className="rounded-xl border border-[#3D2E0A] bg-[#2E2810] p-5 text-center">
                          <p className="text-sm font-medium text-[#FFB020]">Condo / co-op unit detected</p>
                          <p className="text-xs text-[#FFB020]/70 mt-1">This appears to be a condo or co-op unit. HPD tracks building violations under the master building address, not individual units. Try searching the main building address instead for a complete violation history.</p>
                        </div>
                      );
                    }
                    if (noData && !bd) {
                      return (
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-center">
                          <p className="text-sm font-medium text-[var(--muted)]">No HPD data found for this address</p>
                          <p className="text-xs text-[var(--muted-dim)] mt-1">This may be a condo or co-op unit, a new building, or an address not yet in HPD&apos;s system. Try searching the main building address if this is a condo or co-op.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl border border-green-900 bg-green-950 p-5 text-center">
                        <p className="text-sm font-medium text-green-400">No open violations found</p>
                        <p className="text-xs text-green-500/70 mt-1">{timeframe === "recent" ? 'No violations in the last 2 years. Try "All time" to see older records.' : "This building has no unresolved HPD violations on record."}</p>
                      </div>
                    );
                  })()
                )
              )}

              {activeTab === "complaints" && (
                filteredComplaints.length > 0 ? (
                  <PaginatedList items={filteredComplaints} keyFn={(c) => c.id} renderItem={(c) => <ComplaintCard complaint={c} />} />
                ) : (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-center">
                    <p className="text-sm text-[var(--muted)]">No complaints {timeframe === "recent" ? "in the last 2 years" : "on record"}.</p>
                  </div>
                )
              )}

              {activeTab === "litigation" && (
                filteredLitigations.length > 0 ? (
                  <PaginatedList items={filteredLitigations} keyFn={(l) => l.id} renderItem={(l) => <LitigationCard litigation={l} />} />
                ) : (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-center">
                    <p className="text-sm text-[var(--muted)]">No litigation cases {timeframe === "recent" ? "in the last 2 years" : "on record"}.</p>
                  </div>
                )
              )}

              {activeTab === "311" && (
                filtered311.length > 0 ? (
                  <PaginatedList items={filtered311} keyFn={(r) => r.id} renderItem={(r) => <ServiceRequestCard sr={r} />} />
                ) : (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-center">
                    <p className="text-sm text-[var(--muted)]">No 311 service requests {timeframe === "recent" ? "in the last 2 years" : "on record"}.</p>
                  </div>
                )
              )}
            </div>
            </CollapsibleSection>

            {/* Data freshness + disclaimer */}
            <div className="space-y-2 py-2">
              <div className="text-center text-[10px] text-[var(--muted-dim)]">
                {propertyData.from_cache ? "Cached" : "Last updated"}: {formatDate(propertyData.cached_at)}
              </div>
              <p className="text-center text-[10px] text-[var(--muted-dim)]">
                This report covers HPD violations, complaints, litigation, and 311 service requests (DOB, FDNY, DEP, DOHMH).
              </p>
              <p className="text-center text-[10px] text-[var(--muted-dim)]">
                Data source:{" "}
                <a href="https://data.cityofnewyork.us" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--muted)]">
                  NYC HPD Open Data (data.cityofnewyork.us)
                </a>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

