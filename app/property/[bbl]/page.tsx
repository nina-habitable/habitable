"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  mapViolation,
  generatePropertySummary,
  CLASS_INFO,
  type MappedViolation,
} from "../../../lib/violation-mappings";
import type {
  Violation,
  Complaint,
  BedbugReport,
  PropertyResponse,
} from "../../../lib/property-types";

// ─── Helpers ────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const twoYearsAgo = new Date(Date.now() - TWO_YEARS_MS);
const twoYearsAgoLabel = twoYearsAgo.toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});
const twoYearsAgoISO = twoYearsAgo.toISOString();

function isRecent(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr >= twoYearsAgoISO;
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
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
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
    const count =
      (patternCounts["no-heat"] || 0) + (patternCounts["hot-water"] || 0);
    questions.push({
      text: `This building has ${count} heat or hot water violation${count === 1 ? "" : "s"}.`,
      copyText:
        "I noticed this building has heat/hot water violations on file with HPD. Has the boiler been repaired or replaced? What happened last winter?",
    });
  }

  if (patternCounts["water-leak"]) {
    const count = patternCounts["water-leak"];
    questions.push({
      text: `This building has ${count} water leak violation${count === 1 ? "" : "s"}.`,
      copyText:
        "I see there are water leak violations on file with HPD for this building. What is the source of the leaks? Have the pipes been inspected recently?",
    });
  }

  if (
    patternCounts["vermin-rats"] ||
    patternCounts["vermin-roaches"] ||
    patternCounts["vermin-general"] ||
    patternCounts["bed-bugs"]
  ) {
    const count =
      (patternCounts["vermin-rats"] || 0) +
      (patternCounts["vermin-roaches"] || 0) +
      (patternCounts["vermin-general"] || 0) +
      (patternCounts["bed-bugs"] || 0);
    questions.push({
      text: `This building has ${count} pest violation${count === 1 ? "" : "s"}.`,
      copyText:
        "I noticed pest violations on file with HPD for this building. How often does the exterminator come? When was the last treatment?",
    });
  }

  if (patternCounts["lead-paint"]) {
    questions.push({
      text: "This building has lead paint violations.",
      copyText:
        "I see lead paint violations on file with HPD for this building. Has lead abatement been completed? Can you provide the lead paint disclosure form?",
    });
  }

  if (patternCounts["mold"]) {
    questions.push({
      text: "This building has mold violations.",
      copyText:
        "I noticed mold violations on file with HPD. What was the source of moisture? Has professional remediation been done?",
    });
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
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Components ─────────────────────────────────────

function ClassBadge({ cls }: { cls: string }) {
  const info = CLASS_INFO[cls as keyof typeof CLASS_INFO];
  if (!info)
    return <span className="text-xs text-[var(--muted)]">Class {cls}</span>;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: info.bgColor, color: info.color }}
    >
      Class {cls} · {info.label}
    </span>
  );
}

function ViolationCard({
  violation,
  mapped,
}: {
  violation: Violation;
  mapped: MappedViolation;
}) {
  const info = CLASS_INFO[violation.class as keyof typeof CLASS_INFO];
  return (
    <div
      className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: info?.color || "#555",
      }}
    >
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug mb-1">
          {mapped.title}
        </h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
          {mapped.explanation}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ClassBadge cls={violation.class} />
          {info && (
            <span className="text-[10px] text-[var(--muted-dim)]">
              {info.deadline}
            </span>
          )}
          <span className="text-[10px] text-[var(--muted-dim)]">
            Inspected {formatDate(violation.inspectiondate)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Property Page ──────────────────────────────────

export default function PropertyPage({
  params,
}: {
  params: { bbl: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bbl = params.bbl;

  const [address, setAddress] = useState("");
  const [borough, setBorough] = useState("");
  const [addressLabel] = useState(
    searchParams.get("address") || ""
  );
  const [propertyData, setPropertyData] = useState<PropertyResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [timeframe, setTimeframe] = useState<"recent" | "all">("recent");

  // Fetch property data on mount
  useEffect(() => {
    async function load() {
      setLoadingProperty(true);
      try {
        const res = await fetch(`/api/property?bbl=${encodeURIComponent(bbl)}`);
        if (!res.ok) throw new Error("Failed to fetch property data");
        const data: PropertyResponse = await res.json();
        setPropertyData(data);
      } catch {
        setError("Failed to load property data.");
      } finally {
        setLoadingProperty(false);
      }
    }
    load();
  }, [bbl]);

  // ─── Search handler (redirects to new BBL) ───
  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;

    if (!/\d/.test(trimmed)) {
      setError("Please include a street number (e.g. 553 Howard Ave, Brooklyn)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = borough ? `${trimmed}, ${borough}, NY` : trimmed;
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;

      if (!foundBbl) {
        setError("No results found for that address. Try a valid NYC address.");
        setLoading(false);
        return;
      }

      const label = feature.properties.label || "";
      router.push(`/property/${foundBbl}?address=${encodeURIComponent(label)}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ─── Derived data ───
  const filteredViolations = useMemo(() => {
    if (!propertyData) return [];
    if (timeframe === "all") return propertyData.violations;
    return propertyData.violations.filter((v) => isRecent(v.inspectiondate));
  }, [propertyData, timeframe]);

  const sortedViolations = useMemo(() => {
    return [...filteredViolations].sort((a, b) => {
      const da = a.inspectiondate ?? "";
      const db = b.inspectiondate ?? "";
      return db.localeCompare(da);
    });
  }, [filteredViolations]);

  const mappedViolations = useMemo(
    () =>
      sortedViolations.map((v) => ({
        violation: v,
        mapped: mapViolation(v.novdescription ?? ""),
      })),
    [sortedViolations]
  );

  const summary = useMemo(() => {
    if (!propertyData) return null;
    if (timeframe === "all") {
      return generatePropertySummary(
        propertyData.violations.map((v) => ({
          class: v.class,
          novdescription: v.novdescription ?? "",
          inspectiondate: v.inspectiondate ?? new Date().toISOString(),
        })),
        propertyData.complaint_count,
        propertyData.litigations.length,
        propertyData.vacate_orders.length > 0
      );
    }
    return generatePropertySummary(
      propertyData.violations.map((v) => ({
        class: v.class,
        novdescription: v.novdescription ?? "",
        inspectiondate: v.inspectiondate ?? undefined,
      })),
      propertyData.complaint_count,
      propertyData.litigations.length,
      propertyData.vacate_orders.length > 0
    );
  }, [propertyData, timeframe]);

  const topCategories = useMemo(
    () => getTopCategories(mappedViolations),
    [mappedViolations]
  );

  const complaintCategories = useMemo(() => {
    if (!propertyData) return [];
    const complaints =
      timeframe === "recent"
        ? propertyData.complaints.filter((c) => isRecent(c.received_date))
        : propertyData.complaints;
    return getComplaintCategories(complaints);
  }, [propertyData, timeframe]);

  const filteredComplaintCount = useMemo(() => {
    if (!propertyData) return 0;
    if (timeframe === "all") {
      return new Set(propertyData.complaints.map((c) => c.complaint_id)).size;
    }
    return propertyData.complaint_count;
  }, [propertyData, timeframe]);

  const filteredLitigationCount = useMemo(() => {
    if (!propertyData) return 0;
    if (timeframe === "all") return propertyData.litigations.length;
    return propertyData.litigations.filter((l) => isRecent(l.caseopendate))
      .length;
  }, [propertyData, timeframe]);

  const filteredBedbugs = useMemo(() => {
    const all = propertyData?.bedbug_reports ?? [];
    if (all.length === 0) return [] as BedbugReport[];
    const sorted = [...all].sort((a, b) =>
      (b.filing_date ?? "").localeCompare(a.filing_date ?? "")
    );
    if (timeframe === "all") return sorted;
    return sorted.filter((r) => {
      if (!r.filing_date) return false;
      return new Date(r.filing_date) >= twoYearsAgo;
    });
  }, [propertyData, timeframe]);

  const landlordQuestions = useMemo(
    () => generateQuestions(mappedViolations),
    [mappedViolations]
  );

  const classCount = (cls: string) =>
    filteredViolations.filter((v) => v.class === cls).length;

  const displayedViolations = mappedViolations.slice(0, visibleCount);

  const timeframeLabel =
    timeframe === "recent" ? `since ${twoYearsAgoLabel}` : "all time";

  // ─── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Compact search header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <h1
              className="text-lg font-bold tracking-tight text-[var(--foreground)] cursor-pointer"
              onClick={() => router.push("/")}
            >
              Habitable
            </h1>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Search another address..."
              className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-dim)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
            />
            <select
              value={borough}
              onChange={(e) => setBorough(e.target.value)}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
            >
              <option value="">Any</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Brooklyn">Brooklyn</option>
              <option value="Queens">Queens</option>
              <option value="Bronx">Bronx</option>
              <option value="Staten Island">Staten Is.</option>
            </select>
            <button
              type="submit"
              disabled={loading || loadingProperty}
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-40"
            >
              {loading ? "..." : "Search"}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {loadingProperty && (
          <p className="text-center text-sm text-[var(--muted)] py-12">
            Loading building data...
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {propertyData && (
          <div className="space-y-5">
            {/* Address header */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {addressLabel || `Property ${bbl}`}
              </h2>
              <p className="text-sm text-[var(--muted-dim)] font-[family-name:var(--font-geist-mono)]">
                BBL {bbl}
              </p>
            </div>

            {/* Vacate order banner */}
            {propertyData.vacate_orders.length > 0 && (
              <div className="rounded-xl border-2 border-red-700 bg-red-950 p-5">
                <p className="text-base font-bold text-red-400 mb-1">
                  Active Vacate Order
                </p>
                <p className="text-sm text-red-300">
                  HPD has declared conditions in this building uninhabitable.
                  Reason:{" "}
                  {propertyData.vacate_orders[0].reason ?? "Not specified"}
                </p>
                {propertyData.vacate_orders[0].effective_date && (
                  <p className="text-xs text-red-400/70 mt-1">
                    Effective{" "}
                    {formatDate(propertyData.vacate_orders[0].effective_date)}{" "}
                    · {propertyData.vacate_orders[0].units_vacated ?? "?"} units
                    vacated
                  </p>
                )}
              </div>
            )}

            {/* Plain-English summary */}
            {summary && (
              <div
                className="rounded-xl border bg-[var(--card)] p-5"
                style={{
                  borderColor:
                    summary.severityLevel === "severe" ||
                    summary.severityLevel === "serious"
                      ? "#5C1B1B"
                      : summary.severityLevel === "clean"
                        ? "#1B3D1B"
                        : "var(--card-border)",
                }}
              >
                <p className="font-semibold text-[var(--foreground)] text-sm leading-relaxed mb-2">
                  {summary.headline}
                </p>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {summary.details}
                </p>
                {topCategories.length > 0 && (
                  <p className="text-xs text-[var(--muted)] leading-relaxed mt-2">
                    Most common{" "}
                    {timeframe === "recent" ? "recent " : ""}issues:{" "}
                    {topCategories
                      .map((c) => `${c.count} ${c.title.toLowerCase()}`)
                      .join(", ")}
                    .
                  </p>
                )}
                {complaintCategories.length > 0 && (
                  <p className="text-xs text-[var(--muted-dim)] leading-relaxed mt-1">
                    Top complaint categories:{" "}
                    {complaintCategories
                      .map((c) => `${c.category.toLowerCase()} (${c.count})`)
                      .join(", ")}
                    .
                  </p>
                )}
                {summary.olderNote && timeframe === "recent" && (
                  <p className="text-xs text-[var(--muted-dim)] leading-relaxed mt-2">
                    {summary.olderNote}
                  </p>
                )}
              </div>
            )}

            {/* Questions to ask your landlord */}
            {landlordQuestions.length > 0 && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Questions to ask before signing
                </h3>
                <div className="space-y-3">
                  {landlordQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3"
                    >
                      <p className="text-xs text-[var(--muted)] mb-2">
                        {q.text}
                      </p>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">
                          {q.copyText}
                        </p>
                        <CopyButton text={q.copyText} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeframe toggle */}
            <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-1 border border-[var(--card-border)] w-fit">
              <button
                onClick={() => {
                  setTimeframe("recent");
                  setVisibleCount(10);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeframe === "recent"
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Last 2 years
              </button>
              <button
                onClick={() => {
                  setTimeframe("all");
                  setVisibleCount(10);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeframe === "all"
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                All time
              </button>
            </div>

            {/* Violation class breakdown */}
            {filteredViolations.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-center">
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    {filteredViolations.length}
                  </p>
                  <p className="text-[10px] text-[var(--muted-dim)] mt-0.5">
                    Open
                  </p>
                </div>
                {(["C", "B", "A", "I"] as const).map((cls) => {
                  const info = CLASS_INFO[cls];
                  return (
                    <div
                      key={cls}
                      className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-center"
                    >
                      <p
                        className="text-xl font-bold"
                        style={{ color: info.color }}
                      >
                        {classCount(cls)}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: info.color }}
                      >
                        Class {cls}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Complaints & litigation */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
                <p className="text-xs text-[var(--muted-dim)] mb-0.5">
                  Tenant complaints ({timeframeLabel})
                </p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {filteredComplaintCount}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
                <p className="text-xs text-[var(--muted-dim)] mb-0.5">
                  HPD litigation cases ({timeframeLabel})
                </p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {filteredLitigationCount}
                </p>
              </div>
            </div>

            {/* Bed Bug History */}
            {filteredBedbugs.length > 0 &&
              (() => {
                const totalInfested = filteredBedbugs.reduce(
                  (sum, r) => sum + (r.infested_unit_count || 0),
                  0
                );
                const totalEradicated = filteredBedbugs.reduce(
                  (sum, r) => sum + (r.eradicated_unit_count || 0),
                  0
                );
                const hasActiveInfestation = filteredBedbugs.some(
                  (r) => r.infested_unit_count > 0
                );
                return (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                      Bed Bug History
                    </h3>
                    {hasActiveInfestation ? (
                      <div className="rounded-lg border border-[#3D2E0A] bg-[#2E2810] px-3 py-2 mb-3">
                        <p className="text-sm text-[#FFB020]">
                          Bed bugs have been reported in this building.
                        </p>
                      </div>
                    ) : totalInfested === 0 ? (
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 mb-3">
                        <p className="text-sm text-[var(--muted)]">
                          No active bed bug infestations reported.
                          {totalEradicated > 0 &&
                            ` ${totalEradicated} unit${totalEradicated === 1 ? "" : "s"} previously treated.`}
                        </p>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-lg font-bold text-[var(--foreground)]">
                          {filteredBedbugs.length}
                        </p>
                        <p className="text-[10px] text-[var(--muted-dim)]">
                          Annual filings
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--foreground)]">
                          {formatDate(filteredBedbugs[0].filing_date)}
                        </p>
                        <p className="text-[10px] text-[var(--muted-dim)]">
                          Most recent filing
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--foreground)]">
                          {totalEradicated > 0
                            ? totalEradicated
                            : totalInfested}
                        </p>
                        <p className="text-[10px] text-[var(--muted-dim)]">
                          {totalEradicated > 0
                            ? "Units treated"
                            : "Infested units reported"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Violation cards */}
            {filteredViolations.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Open Violations
                </h3>
                <div className="space-y-2">
                  {displayedViolations.map(({ violation, mapped }) => (
                    <ViolationCard
                      key={violation.id}
                      violation={violation}
                      mapped={mapped}
                    />
                  ))}
                </div>
                {visibleCount < mappedViolations.length && (
                  <button
                    onClick={() => {
                      if (visibleCount < 20) {
                        setVisibleCount(20);
                      } else {
                        setVisibleCount(mappedViolations.length);
                      }
                    }}
                    className="mt-3 w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {visibleCount < 20
                      ? "Show next 10"
                      : `Show all ${mappedViolations.length - visibleCount} remaining`}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-green-900 bg-green-950 p-5 text-center">
                <p className="text-sm font-medium text-green-400">
                  No open violations found
                </p>
                <p className="text-xs text-green-500/70 mt-1">
                  {timeframe === "recent"
                    ? 'No violations in the last 2 years. Try "All time" to see older records.'
                    : "This building has no unresolved HPD violations on record."}
                </p>
              </div>
            )}

            {/* Ownership */}
            {propertyData.litigations.length > 0 &&
              propertyData.litigations[0].respondent && (
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                    Building Owner (per HPD)
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {propertyData.litigations[0].respondent}
                  </p>
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                    This may be an LLC. The actual beneficial owner may be
                    different.
                  </p>
                </div>
              )}

            {/* Data freshness */}
            <div className="text-center text-[10px] text-[var(--muted-dim)] py-2">
              {propertyData.from_cache ? "Cached" : "Last updated"}:{" "}
              {formatDate(propertyData.cached_at)} · Source: NYC HPD Open Data
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
