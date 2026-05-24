"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Footer from "../components/Footer";

interface HabitableScore {
  type: "clean" | "score" | "no_score";
  accentColor?: "green" | "amber" | "red";
}

interface BuildingEntry {
  bbl: string;
  address: string;
  borough: string;
  zip: string;
  has_cached_data: boolean;
  open_violations: number | null;
  complaints: number | null;
  habitable_score: HabitableScore | null;
  aep_active?: boolean;
}

interface PortfolioResponse {
  entity_name: string;
  buildings_as_owner: BuildingEntry[];
  buildings_as_manager: BuildingEntry[];
  total_buildings: number;
}

function scoreCategory(score: HabitableScore | null): "green" | "amber" | "red" | null {
  if (!score) return null;
  if (score.type === "clean") return "green";
  if (score.type === "score") return score.accentColor ?? null;
  return null; // no_score (missing unit count or active AEP)
}

// The dot the portfolio page shows. AEP overrides everything to red. When the
// score is unavailable we still indicate health from the violation count, so
// every building with data gets a dot.
function dotCategory(b: BuildingEntry): "green" | "amber" | "red" | null {
  if (b.aep_active) return "red";
  const cat = scoreCategory(b.habitable_score);
  if (cat) return cat;
  if (b.open_violations === null) return null; // no data at all
  return b.open_violations > 0 ? "red" : "green";
}

function ScoreDot({ category }: { category: "green" | "amber" | "red" | null }) {
  if (!category) return null;
  const color =
    category === "green" ? "var(--signal-green)" : category === "amber" ? "var(--signal-amber)" : "var(--signal-red)";
  return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function BuildingCard({ b, selfManaged }: { b: BuildingEntry; selfManaged?: boolean }) {
  const href = `/property/${b.bbl}?address=${encodeURIComponent([b.address, b.borough].filter(Boolean).join(", "))}`;
  const hasData = b.open_violations !== null;
  return (
    <div className="rounded-xl border border-[var(--hab-line)] bg-[var(--hab-paper)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="text-sm font-medium text-[var(--hab-ink)] hover:underline break-words">
            {b.address}
          </Link>
          <p className="text-[11px] text-[var(--hab-muted)] mt-0.5">
            {[b.borough, b.zip].filter(Boolean).join(" · ")}
          </p>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--hab-muted)] mt-0.5">BBL {b.bbl}</p>
        </div>
        <ScoreDot category={dotCategory(b)} />
      </div>

      {hasData ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full border border-[var(--hab-line)] px-2.5 py-0.5 text-[11px] font-[family-name:var(--font-mono)]"
            style={{ color: (b.open_violations ?? 0) > 0 ? "var(--sev-c)" : "var(--hab-ink-2)" }}
          >
            {b.open_violations ?? 0} open violation{b.open_violations === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-[var(--hab-line)] px-2.5 py-0.5 text-[11px] font-[family-name:var(--font-mono)] text-[var(--hab-ink-2)]">
            {b.complaints ?? 0} complaint{b.complaints === 1 ? "" : "s"}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--hab-muted)]">Not yet looked up</p>
      )}

      {selfManaged && (
        <p className="mt-2 text-[11px] text-[var(--hab-muted)]">Also self-managed</p>
      )}
    </div>
  );
}

function BuildingSection({ title, buildings, selfManagedBbls }: { title: string; buildings: BuildingEntry[]; selfManagedBbls?: Set<string> }) {
  if (buildings.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">
        {title} ({buildings.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {buildings.map((b) => (
          <BuildingCard key={`${title}-${b.bbl}`} b={b} selfManaged={selfManagedBbls?.has(b.bbl)} />
        ))}
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-8 animate-pulse">
      <div className="h-5 w-48 rounded bg-[var(--hab-surface)] mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--hab-line)] bg-[var(--hab-paper)] p-5">
            <div className="h-4 w-3/4 rounded bg-[var(--hab-surface)] mb-2" />
            <div className="h-3 w-1/2 rounded bg-[var(--hab-surface)] mb-3" />
            <div className="h-5 w-2/3 rounded bg-[var(--hab-surface)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!name) {
      setError("No entity name provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolio?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error("Request failed");
      const json: PortfolioResponse = await res.json();
      setData(json);
    } catch {
      setError("Something went wrong loading this portfolio.");
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.total_buildings ?? 0;
  const hasResults = total > 0;

  const HOA_INDICATORS = [
    "HOA",
    "HOMEOWNER",
    "CONDOMINIUM",
    "CONDO ASSOC",
    "OWNERS CORP",
    "APT CORP",
    "APARTMENT CORP",
    "TENANTS CORP",
    "COOPERATIVE",
    "CO-OP",
  ];
  const isLikelyHOA = HOA_INDICATORS.some((k) => name.toUpperCase().includes(k));

  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-ui)]">
      <header className="border-b border-[var(--hab-line)] bg-[var(--hab-paper)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <Link href="/" className="text-lg font-[family-name:var(--font-serif)] font-semibold tracking-tight text-[var(--hab-ink)]">
            Habitable
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] leading-tight break-words">
          {name || "Portfolio"}
        </h1>
        {isLikelyHOA && (
          <p className="text-xs text-[var(--hab-muted)] mt-2 leading-relaxed">
            This appears to be a homeowners association. Individual units in this building may be separately owned.
          </p>
        )}

        {loading && (
          <>
            <p className="text-sm text-[var(--hab-muted)] mt-2">Looking up buildings across NYC...</p>
            <LoadingSkeleton />
          </>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-xl border px-4 py-4 text-sm" style={{ borderColor: "var(--banner-red-border)", background: "var(--banner-red-bg)", color: "var(--banner-red-ink)" }}>
            <p>{error}</p>
            <button
              onClick={load}
              className="mt-3 rounded-lg border border-[var(--banner-red-border)] px-3 py-1.5 text-xs font-medium hover:opacity-80"
              style={{ color: "var(--banner-red-ink)" }}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (() => {
          // Deduplicate: a building owned AND managed by the entity shows only
          // under "own", flagged as self-managed.
          const ownerBbls = new Set(data.buildings_as_owner.map((b) => b.bbl));
          const selfManagedBbls = new Set(
            data.buildings_as_manager.filter((b) => ownerBbls.has(b.bbl)).map((b) => b.bbl)
          );
          const ownerBuildings = data.buildings_as_owner;
          const managerBuildings = data.buildings_as_manager.filter((b) => !ownerBbls.has(b.bbl));

          // Unique buildings across both lists for the portfolio assessment.
          const uniqueBuildings = new Map<string, BuildingEntry>();
          for (const b of [...ownerBuildings, ...managerBuildings]) {
            if (!uniqueBuildings.has(b.bbl)) uniqueBuildings.set(b.bbl, b);
          }
          const allBuildings = Array.from(uniqueBuildings.values());
          const withData = allBuildings.filter((b) => b.open_violations !== null);
          const totalOpenViolations = withData.reduce((s, b) => s + (b.open_violations ?? 0), 0);
          const totalComplaints = withData.reduce((s, b) => s + (b.complaints ?? 0), 0);

          // Count buildings by score-based dot color (same thresholds as property page).
          let green = 0;
          let amber = 0;
          let red = 0;
          for (const b of allBuildings) {
            const cat = dotCategory(b);
            if (cat === "green") green += 1;
            else if (cat === "amber") amber += 1;
            else if (cat === "red") red += 1;
          }
          const scored = green + amber + red;

          const scopeWord =
            managerBuildings.length === 0 ? "they own" : ownerBuildings.length === 0 ? "they manage" : "in this portfolio";
          const scopeTotal = allBuildings.length;
          const buildingWord = scopeTotal === 1 ? "building" : "buildings";
          const scope = `${scopeTotal} ${buildingWord} ${scopeWord}`;
          const complaintSentence =
            totalComplaints > 0
              ? ` Tenants have filed ${totalComplaints} complaint${totalComplaints === 1 ? "" : "s"} in the last 2 years.`
              : "";

          let assessmentLine: string;
          if (scored === 0) {
            assessmentLine =
              totalOpenViolations === 0
                ? `None of the ${scope} have open violations in the last 2 years.`
                : `The ${scope} have ${totalOpenViolations} open violation${totalOpenViolations === 1 ? "" : "s"} in the last 2 years.${complaintSentence}`;
          } else if (amber === 0 && red === 0 && totalOpenViolations === 0) {
            assessmentLine = `All ${scope} score above average for similar-sized NYC buildings, with no open violations in the last 2 years.`;
          } else {
            const parts: string[] = [];
            if (green > 0) parts.push(`${green} score above average`);
            if (amber > 0) parts.push(`${amber} ${amber === 1 ? "is" : "are"} moderate`);
            if (red > 0) parts.push(`${red} ${red === 1 ? "is" : "are"} below average`);
            assessmentLine = `Of ${scope}, ${joinList(parts)} for similar-sized NYC buildings.${complaintSentence}`;
          }

          const missingData = allBuildings.length - withData.length;

          return (
          <>
            <p className="text-sm text-[var(--hab-ink-2)] mt-2">
              {hasResults
                ? `Associated with ${total} building${total === 1 ? "" : "s"} across NYC`
                : "No buildings found"}
            </p>
            <p className="text-xs text-[var(--hab-muted)] mt-2 leading-relaxed">
              Showing exact name matches from HPD registration records. Some buildings may be registered under name variations.
            </p>

            {hasResults && withData.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--hab-line)] bg-[var(--hab-surface)] p-4 sm:p-5">
                <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)] mb-2">
                  Portfolio assessment
                </p>
                <p className="text-sm text-[var(--hab-ink)] leading-relaxed">{assessmentLine}</p>
              </div>
            )}

            {hasResults && missingData > 0 && (
              <p className="mt-3 text-xs text-[var(--hab-muted)] leading-relaxed">
                Showing data for {withData.length} of {allBuildings.length} buildings. Look up individual buildings for full details.
              </p>
            )}

            {hasResults ? (
              <>
                <BuildingSection title="Buildings they own" buildings={ownerBuildings} selfManagedBbls={selfManagedBbls} />
                <BuildingSection title="Buildings they manage" buildings={managerBuildings} />
              </>
            ) : (
              <div className="mt-6 rounded-xl border border-[var(--hab-line)] bg-[var(--hab-paper)] p-5">
                <p className="text-sm text-[var(--hab-ink-2)]">
                  We could not find any buildings registered under this exact name.
                </p>
                <p className="text-xs text-[var(--hab-muted)] mt-2 leading-relaxed">
                  HPD records this entity under a slightly different name, or the building has not filed a current registration.
                </p>
              </div>
            )}
          </>
          );
        })()}

        <div className="mt-10">
          <Link href="/" className="text-xs text-[var(--hab-muted)] hover:text-[var(--hab-ink)]">
            Search another address
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--hab-muted)]">Loading...</p>
      </div>
    }>
      <PortfolioContent />
    </Suspense>
  );
}
