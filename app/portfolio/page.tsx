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
}

interface PortfolioResponse {
  entity_name: string;
  buildings_as_owner: BuildingEntry[];
  buildings_as_manager: BuildingEntry[];
  total_buildings: number;
}

function ScoreDot({ score }: { score: HabitableScore | null }) {
  if (!score) return null;
  let color: string | null = null;
  if (score.type === "clean") {
    color = "var(--signal-green)";
  } else if (score.type === "score") {
    color =
      score.accentColor === "green"
        ? "var(--signal-green)"
        : score.accentColor === "amber"
          ? "var(--signal-amber)"
          : "var(--signal-red)";
  }
  if (!color) return null;
  return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

function BuildingCard({ b }: { b: BuildingEntry }) {
  const href = `/property/${b.bbl}?address=${encodeURIComponent([b.address, b.borough].filter(Boolean).join(", "))}`;
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
        <ScoreDot score={b.habitable_score} />
      </div>

      {b.has_cached_data ? (
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
    </div>
  );
}

function BuildingSection({ title, buildings }: { title: string; buildings: BuildingEntry[] }) {
  if (buildings.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">
        {title} ({buildings.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {buildings.map((b) => (
          <BuildingCard key={`${title}-${b.bbl}`} b={b} />
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

        {!loading && !error && data && (
          <>
            <p className="text-sm text-[var(--hab-ink-2)] mt-2">
              {hasResults
                ? `Associated with ${total} building${total === 1 ? "" : "s"} across NYC`
                : "No buildings found"}
            </p>
            <p className="text-xs text-[var(--hab-muted)] mt-2 leading-relaxed">
              Showing exact name matches from HPD registration records. Some buildings may be registered under name variations.
            </p>

            {hasResults ? (
              <>
                <BuildingSection title="Buildings they own" buildings={data.buildings_as_owner} />
                <BuildingSection title="Buildings they manage" buildings={data.buildings_as_manager} />
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
        )}

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
