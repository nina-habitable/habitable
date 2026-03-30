"use client";

import { useState, FormEvent, useMemo } from "react";
import {
  mapViolation,
  generatePropertySummary,
  CLASS_INFO,
  type MappedViolation,
} from "../lib/violation-mappings";

// ─── Types ──────────────────────────────────────────

interface Violation {
  id: string;
  bbl: string;
  class: string;
  status: string | null;
  novdescription: string | null;
  inspectiondate: string | null;
  currentstatusdate: string | null;
}

interface VacateOrder {
  id: string;
  bbl: string;
  vacate_type: string | null;
  reason: string | null;
  effective_date: string | null;
  units_vacated: string | null;
}

interface Complaint {
  id: string;
  bbl: string;
  complaint_id: string | null;
  complaint_status: string | null;
  major_category: string | null;
  type: string | null;
  received_date: string | null;
}

interface Litigation {
  id: string;
  bbl: string;
  building_id: string | null;
  casetype: string | null;
  casestatus: string | null;
  caseopendate: string | null;
  respondent: string | null;
}

interface PropertyResponse {
  violations: Violation[];
  vacate_orders: VacateOrder[];
  complaints: Complaint[];
  complaint_count: number;
  litigations: Litigation[];
  cached_at: string;
  from_cache: boolean;
}

// ─── Helpers ────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const twoYearsAgoLabel = new Date(
  Date.now() - 2 * 365 * 24 * 60 * 60 * 1000
).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ─── Components ─────────────────────────────────────

function ClassBadge({ cls }: { cls: string }) {
  const info = CLASS_INFO[cls];
  if (!info) return <span className="text-xs text-gray-500">Class {cls}</span>;
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
  const info = CLASS_INFO[violation.class];
  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: info?.bgColor || "#E5E5E3" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{mapped.icon}</span>
            <h3 className="font-semibold text-[#1A1A18] text-sm leading-snug">
              {mapped.title}
            </h3>
          </div>
          <p className="text-xs text-[#6B6B66] leading-relaxed mb-2">
            {mapped.explanation}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ClassBadge cls={violation.class} />
            {info && (
              <span className="text-[10px] text-[#9B9B96]">
                {info.deadline}
              </span>
            )}
            <span className="text-[10px] text-[#9B9B96]">
              Inspected {formatDate(violation.inspectiondate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────

export default function Home() {
  const [address, setAddress] = useState("");
  const [bbl, setBbl] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Memoized derived data
  const sortedViolations = useMemo(() => {
    if (!propertyData) return [];
    return [...propertyData.violations].sort((a, b) => {
      const da = a.inspectiondate ?? "";
      const db = b.inspectiondate ?? "";
      return db.localeCompare(da);
    });
  }, [propertyData]);

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
    return generatePropertySummary(
      propertyData.violations.map((v) => ({
        class: v.class,
        novdescription: v.novdescription ?? "",
      })),
      propertyData.complaint_count,
      propertyData.litigations.length,
      propertyData.vacate_orders.length > 0
    );
  }, [propertyData]);

  const classCount = (cls: string) =>
    propertyData?.violations.filter((v) => v.class === cls).length ?? 0;

  async function fetchPropertyData(bblValue: string) {
    setLoadingProperty(true);
    try {
      const res = await fetch(
        `/api/property?bbl=${encodeURIComponent(bblValue)}`
      );
      if (!res.ok) throw new Error("Failed to fetch property data");
      const data: PropertyResponse = await res.json();
      setPropertyData(data);
    } catch {
      setError("Failed to load property data.");
    } finally {
      setLoadingProperty(false);
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;

    if (!/\d/.test(trimmed)) {
      setError(
        "Please include a street number (e.g. 553 Howard Ave, Brooklyn)"
      );
      return;
    }

    setLoading(true);
    setError("");
    setBbl("");
    setAddressLabel("");
    setPropertyData(null);
    setShowAll(false);

    try {
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;

      if (!foundBbl) {
        setError("No results found for that address. Try a valid NYC address.");
        return;
      }

      setBbl(foundBbl);
      setAddressLabel(feature.properties.label);
      setLoading(false);

      await fetchPropertyData(foundBbl);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const displayedViolations = showAll
    ? mappedViolations
    : mappedViolations.slice(0, 10);

  // ─── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Search header */}
      <header className="border-b border-[#E5E5E3] bg-white">
        <div className="mx-auto max-w-2xl px-5 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A18] mb-1">
            Habitable
          </h1>
          <p className="text-sm text-[#6B6B66] mb-5">
            Look up any NYC building before you sign a lease
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter a NYC address (e.g. 553 Howard Ave, Brooklyn)"
              className="flex-1 rounded-lg border border-[#D5D5D0] bg-white px-4 py-2.5 text-sm text-[#1A1A18] placeholder:text-[#9B9B96] outline-none focus:border-[#1A1A18] focus:ring-1 focus:ring-[#1A1A18]"
            />
            <button
              type="submit"
              disabled={loading || loadingProperty}
              className="rounded-lg bg-[#1A1A18] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#333330] disabled:opacity-40"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {/* Loading states */}
        {loading && (
          <p className="text-center text-sm text-[#9B9B96] py-12">
            Looking up address...
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading property data */}
        {loadingProperty && (
          <p className="text-center text-sm text-[#9B9B96] py-12">
            Loading building data...
          </p>
        )}

        {/* ─── Property Profile ─── */}
        {propertyData && (
          <div className="space-y-5">
            {/* Address header card */}
            <div className="rounded-xl border border-[#E5E5E3] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1A1A18]">
                {addressLabel}
              </h2>
              <p className="text-sm text-[#9B9B96] font-[family-name:var(--font-geist-mono)]">
                BBL {bbl}
              </p>
            </div>

            {/* Vacate order banner */}
            {propertyData.vacate_orders.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-5">
                <p className="text-base font-bold text-red-800 mb-1">
                  Active Vacate Order
                </p>
                <p className="text-sm text-red-700">
                  HPD has declared conditions in this building uninhabitable.
                  Reason:{" "}
                  {propertyData.vacate_orders[0].reason ?? "Not specified"}
                </p>
                {propertyData.vacate_orders[0].effective_date && (
                  <p className="text-xs text-red-600 mt-1">
                    Effective{" "}
                    {formatDate(propertyData.vacate_orders[0].effective_date)} ·{" "}
                    {propertyData.vacate_orders[0].units_vacated ?? "?"} units
                    vacated
                  </p>
                )}
              </div>
            )}

            {/* Plain-English summary */}
            {summary && (
              <div
                className="rounded-xl border bg-white p-5 shadow-sm"
                style={{
                  borderColor:
                    summary.severityLevel === "severe" ||
                    summary.severityLevel === "serious"
                      ? "#FCEBEB"
                      : summary.severityLevel === "clean"
                        ? "#D8EDD8"
                        : "#E5E5E3",
                }}
              >
                <p className="font-semibold text-[#1A1A18] text-sm leading-relaxed mb-2">
                  {summary.headline}
                </p>
                <p className="text-sm text-[#6B6B66] leading-relaxed">
                  {summary.details}
                </p>
              </div>
            )}

            {/* Violation class breakdown */}
            {propertyData.violations.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                <div className="rounded-xl border border-[#E5E5E3] bg-white p-3 text-center shadow-sm">
                  <p className="text-xl font-bold text-[#1A1A18]">
                    {propertyData.violations.length}
                  </p>
                  <p className="text-[10px] text-[#9B9B96] mt-0.5">
                    All Open
                  </p>
                </div>
                {(["C", "B", "A", "I"] as const).map((cls) => {
                  const info = CLASS_INFO[cls];
                  return (
                    <div
                      key={cls}
                      className="rounded-xl border bg-white p-3 text-center shadow-sm"
                      style={{ borderColor: info.bgColor }}
                    >
                      <p className="text-xl font-bold" style={{ color: info.color }}>
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

            {/* Complaints & litigation row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#E5E5E3] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-[#9B9B96] mb-0.5">
                  Tenant complaints since {twoYearsAgoLabel}
                </p>
                <p className="text-lg font-bold text-[#1A1A18]">
                  {propertyData.complaint_count}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E5E3] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-[#9B9B96] mb-0.5">
                  HPD litigation cases
                </p>
                <p className="text-lg font-bold text-[#1A1A18]">
                  {propertyData.litigations.length}
                </p>
              </div>
            </div>

            {/* Violation cards */}
            {propertyData.violations.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-[#1A1A18] mb-3">
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
                {mappedViolations.length > 10 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-3 w-full rounded-xl border border-[#D5D5D0] bg-white py-2.5 text-sm font-medium text-[#6B6B66] hover:bg-[#F5F5F3] shadow-sm"
                  >
                    Show all {mappedViolations.length} violations
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                <p className="text-sm font-medium text-green-800">
                  No open violations found
                </p>
                <p className="text-xs text-green-600 mt-1">
                  This building has no unresolved HPD violations on record.
                </p>
              </div>
            )}

            {/* Ownership placeholder */}
            {propertyData.litigations.length > 0 &&
              propertyData.litigations[0].respondent && (
                <div className="rounded-xl border border-[#E5E5E3] bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#1A1A18] mb-1">
                    Building Owner (per HPD)
                  </h3>
                  <p className="text-sm text-[#6B6B66]">
                    {propertyData.litigations[0].respondent}
                  </p>
                  <p className="text-[10px] text-[#9B9B96] mt-1">
                    This may be an LLC. The actual beneficial owner may be
                    different.
                  </p>
                </div>
              )}

            {/* Data freshness */}
            <div className="text-center text-[10px] text-[#9B9B96] py-2">
              {propertyData.from_cache ? "Cached" : "Last updated"}:{" "}
              {formatDate(propertyData.cached_at)} · Source: NYC HPD Open Data
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
