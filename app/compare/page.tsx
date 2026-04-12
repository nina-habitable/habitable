"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AddressAutocomplete from "../components/AddressAutocomplete";
import {
  generatePropertySummary,
  splitByRecency,
  CLASS_INFO,
} from "../../lib/violation-mappings";
import type { PropertyResponse } from "../../lib/property-types";
import { calculateHabitableScore, SHOW_HABITABLE_SCORE } from "../../lib/habitable-score";

// ─── Constants ──────────────────────────────────────

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const twoYearsAgo = new Date(Date.now() - TWO_YEARS_MS);
const twoYearsAgoISO = twoYearsAgo.toISOString();

function isRecent(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr >= twoYearsAgoISO;
}

const CLOSED_STATUSES = new Set([
  "VIOLATION CLOSED", "VIOLATION DISMISSED", "NOV CERTIFIED LATE",
  "NOV CERTIFIED ON TIME", "INFO NOV SENT OUT", "LEAD DOCS SUBMITTED, ACCEPTABLE",
  "CERTIFICATION POSTPONEMENT GRANTED",
]);

function isOpenViolation(status: string | null): boolean {
  if (!status) return true;
  return !CLOSED_STATUSES.has(status.toUpperCase());
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  clean: { bg: "#1B3D1B", text: "#4ADE80", label: "Clean" },
  minor: { bg: "#2E2810", text: "#D4A843", label: "Minor" },
  moderate: { bg: "#3D2E0A", text: "#FFB020", label: "Moderate" },
  serious: { bg: "#3D1414", text: "#FF4D4D", label: "Serious" },
  severe: { bg: "#5C1B1B", text: "#FF4D4D", label: "Severe" },
};

// ─── Types ──────────────────────────────────────────

interface BuildingData {
  bbl: string;
  addressLabel: string;
  searchQuery?: string;
  propertyData: PropertyResponse;
}

// ─── Search Bar Component ───────────────────────────

function BuildingSearch({
  onResult,
}: {
  onResult: (bbl: string, label: string, data: PropertyResponse, searchQuery?: string) => void;
  loading?: boolean;
}) {
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function fetchAndAdd(bbl: string, label: string, query?: string) {
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/property?bbl=${encodeURIComponent(bbl)}`);
      if (!res.ok) throw new Error();
      const data: PropertyResponse = await res.json();
      onResult(bbl, label, data, query);
    } catch {
      setError("Failed to load property data");
    } finally {
      setAdding(false);
    }
  }

  async function handleManualSubmit({ address }: { address: string }) {
    if (!address) return;
    if (!/\d/.test(address)) { setError("Include a street number"); return; }
    setAdding(true);
    setError("");
    try {
      const query = address;
      const geoRes = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`);
      if (!geoRes.ok) throw new Error();
      const geoData = await geoRes.json();
      const feature = geoData.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;
      if (!foundBbl) { setError("Address not found"); setAdding(false); return; }
      const label = feature.properties.label || foundBbl;
      await fetchAndAdd(foundBbl, label, address);
    } catch {
      setError("Something went wrong");
      setAdding(false);
    }
  }

  return (
    <div>
      <AddressAutocomplete
        onSubmit={handleManualSubmit}
        onSelect={(s) => fetchAndAdd(s.bbl, s.label || s.name, s.name)}
        variant="compact"
      />
      {adding && <p className="text-xs text-[var(--muted-dim)] mt-1">Adding...</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// ─── Building Card Component ────────────────────────

function BuildingCard({
  building,
  onRemove,
}: {
  building: BuildingData;
  onRemove: () => void;
}) {
  const { bbl, addressLabel, searchQuery, propertyData } = building;

  // Fuzzy match: compare house numbers
  const fuzzyMatch = (() => {
    if (!searchQuery || !addressLabel) return false;
    const searchedNum = searchQuery.match(/^\s*(\d+)/)?.[1];
    const returnedNum = addressLabel.match(/^\s*(\d+)/)?.[1];
    return searchedNum && returnedNum && searchedNum !== returnedNum;
  })();

  const recentViolations = propertyData.violations.filter((v) =>
    isRecent(v.inspectiondate) && isOpenViolation(v.status)
  );
  const classC = recentViolations.filter((v) => v.class === "C").length;
  const classB = recentViolations.filter((v) => v.class === "B").length;
  const classA = recentViolations.filter((v) => v.class === "A").length;

  const recentComplaints = propertyData.complaint_count;

  const recentLitigation = propertyData.litigations.filter((l) =>
    isRecent(l.caseopendate)
  ).length;

  const bedbugs = propertyData.bedbug_reports ?? [];
  const recentBedbugs = bedbugs.filter(
    (r) => r.infested_unit_count > 0 && r.filing_date && new Date(r.filing_date) >= twoYearsAgo
  );

  const openViolations = propertyData.violations.filter((v) => isOpenViolation(v.status));
  const summary = generatePropertySummary(
    openViolations.map((v) => ({
      class: v.class,
      novdescription: v.novdescription ?? "",
      inspectiondate: v.inspectiondate ?? undefined,
    })),
    propertyData.complaint_count,
    propertyData.litigations.length,
    propertyData.vacate_orders.some((v) => !v.rescind_date)
  );

  const severity = SEVERITY_COLORS[summary.severityLevel] ?? SEVERITY_COLORS.moderate;

  const { recent } = splitByRecency(
    openViolations.map((v) => ({
      class: v.class,
      novdescription: v.novdescription ?? "",
      inspectiondate: v.inspectiondate ?? undefined,
    }))
  );

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 flex flex-col">
      {/* Fuzzy match note */}
      {fuzzyMatch && searchQuery && (
        <p className="text-[10px] text-[#6B8CAE] mb-2">You searched for {searchQuery}</p>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug truncate">
            {addressLabel}
          </h3>
          <p className="text-[10px] text-[var(--muted-dim)] font-[family-name:var(--font-geist-mono)]">
            BBL {bbl}
          </p>
          {(propertyData.building_details || propertyData.nta) && (
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              {[
                propertyData.building_details?.legal_class_a ? `${propertyData.building_details.legal_class_a} units` : null,
                propertyData.building_details?.legal_stories ? `${propertyData.building_details.legal_stories} stories` : null,
                propertyData.nta || null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-[var(--muted-dim)] hover:text-[var(--foreground)] text-xs shrink-0"
        >
          Remove
        </button>
      </div>

      {/* Severity badge or score */}
      <div className="mb-4 space-y-1">
        {SHOW_HABITABLE_SCORE ? (() => {
          const score = calculateHabitableScore(propertyData, "recent");
          if (score.type === "score") {
            return (
              <p className={`text-sm font-bold ${score.accentColor === "green" ? "text-green-400" : score.accentColor === "amber" ? "text-[#FFB020]" : "text-[#FF4D4D]"}`}>
                Better than {score.percentile}%
              </p>
            );
          }
          if (score.type === "clean") {
            return <p className="text-sm font-bold text-green-400">{score.tier === 1 ? "Clean record" : "No open violations"}</p>;
          }
          if (score.type === "no_score" && score.reason === "aep") {
            return (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[#431407] text-orange-400">
                AEP Watchlist
              </span>
            );
          }
          return <p className="text-xs text-[var(--muted-dim)]">Score unavailable</p>;
        })() : (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: severity.bg, color: severity.text }}
          >
            {severity.label}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-2 flex-1">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Violations (2yr)</span>
          <span className="font-semibold text-[var(--foreground)]">
            {recent.length}
          </span>
        </div>
        <div className="flex justify-between text-xs text-[var(--muted-dim)] pl-3">
          <span>Class breakdown</span>
          <span>
            <span style={{ color: CLASS_INFO.C.color }}>{classC}C</span>
            {" / "}
            <span style={{ color: CLASS_INFO.B.color }}>{classB}B</span>
            {" / "}
            <span style={{ color: CLASS_INFO.A.color }}>{classA}A</span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Complaints (2yr)</span>
          <span className="font-semibold text-[var(--foreground)]">
            {recentComplaints}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Litigation (2yr)</span>
          <span className="font-semibold text-[var(--foreground)]">
            {recentLitigation}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Bed bugs</span>
          <span className="font-semibold" style={{ color: recentBedbugs.length > 0 ? "#FFB020" : "var(--muted)" }}>
            {recentBedbugs.length > 0 ? "Reported" : "Clean"}
          </span>
        </div>
        {(() => {
          const leadCount = (propertyData.lead_violations ?? []).filter((v) => isRecent(v.inspectiondate) && isOpenViolation(v.status)).length;
          const woCount = (propertyData.work_orders ?? []).filter((o) => isRecent(o.created_date)).length;
          return (
            <>
              {leadCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">Lead paint</span>
                  <span className="font-semibold text-[var(--foreground)]">{leadCount} open</span>
                </div>
              )}
              {woCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">Emergency repairs</span>
                  <span className="font-semibold text-[var(--foreground)]">{woCount}</span>
                </div>
              )}
            </>
          );
        })()}

        {/* Vacate order — only if not rescinded */}
        {propertyData.vacate_orders.some((v) => !v.rescind_date) && (
          <div className="rounded-lg border border-red-800 bg-red-950 px-2 py-1.5 mt-2">
            <p className="text-xs font-semibold text-red-400">
              Active vacate order
            </p>
          </div>
        )}
        {(propertyData.aep_status ?? []).some((a) => a.current_status === "AEP Active") && (
          <div className="rounded-lg border border-[#7C2D12] bg-[#431407] px-2 py-1.5 mt-2">
            <p className="text-xs font-semibold text-orange-400">
              AEP Watchlist
            </p>
          </div>
        )}
      </div>

      {/* View full profile link */}
      <Link
        href={`/property/${bbl}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`}
        className="mt-4 block text-center rounded-lg border border-[var(--card-border)] py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        View full profile
      </Link>
    </div>
  );
}

// ─── Compare Page ───────────────────────────────────

function CompareContent() {
  const searchParams = useSearchParams();
  const initialBbls = searchParams.get("bbls")?.split(",").filter(Boolean) ?? [];

  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(initialBbls.length > 0);

  // Update URL when buildings change
  function updateUrl(buildingList: BuildingData[]) {
    const bbls = buildingList.map((b) => b.bbl).join(",");
    const url = bbls ? `/compare?bbls=${bbls}` : "/compare";
    window.history.replaceState(null, "", url);
  }

  // Load initial buildings from URL params
  useEffect(() => {
    if (initialBbls.length === 0) return;

    async function loadInitial() {
      try {
        const results: BuildingData[] = [];
        await Promise.all(
          initialBbls.slice(0, 3).map(async (bblVal) => {
            const propRes = await fetch(`/api/property?bbl=${encodeURIComponent(bblVal)}`);
            if (!propRes.ok) return;
            const propData: PropertyResponse = await propRes.json();
            const label = propData.address_label || `Property ${bblVal}`;
            results.push({ bbl: bblVal, addressLabel: label, propertyData: propData });
          })
        );
        // Maintain the original order from the URL
        const ordered = initialBbls
          .map((b) => results.find((r) => r.bbl === b))
          .filter((r): r is BuildingData => !!r);
        setBuildings(ordered);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResult(bbl: string, label: string, data: PropertyResponse, searchQuery?: string) {
    if (buildings.some((b) => b.bbl === bbl)) return;
    const updated = [...buildings, { bbl, addressLabel: label, searchQuery, propertyData: data }];
    setBuildings(updated);
    updateUrl(updated);
  }

  function removeBuilding(bbl: string) {
    const updated = buildings.filter((b) => b.bbl !== bbl);
    setBuildings(updated);
    updateUrl(updated);
  }

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto max-w-4xl px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-[var(--foreground)]"
            >
              Habitable
            </Link>
            <span className="text-sm text-[var(--muted-dim)]">/ Compare</span>
          </div>
          {buildings.length < 3 && (
            <BuildingSearch onResult={handleResult} loading={loadingInitial} />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        {loadingInitial && (
          <p className="text-center text-sm text-[var(--muted)] py-12">
            Loading building data...
          </p>
        )}

        {buildings.length === 0 && !loadingInitial && (
          <div className="text-center py-16">
            <p className="text-[var(--muted)] text-sm mb-2">
              Search for buildings above to compare them side by side.
            </p>
            <p className="text-[var(--muted-dim)] text-xs">
              Add up to 3 buildings.
            </p>
          </div>
        )}

        {buildings.length > 0 && (
          <div
            className={`grid gap-4 ${
              buildings.length === 1
                ? "grid-cols-1 max-w-md mx-auto"
                : buildings.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-3"
            }`}
          >
            {buildings.map((b) => (
              <BuildingCard
                key={b.bbl}
                building={b}
                onRemove={() => removeBuilding(b.bbl)}
              />
            ))}
          </div>
        )}

        {buildings.length > 0 && buildings.length < 3 && (
          <div className="text-center mt-4">
            <p className="text-xs text-[var(--muted-dim)]">
              {3 - buildings.length} more building{buildings.length === 2 ? "" : "s"} can be added.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
