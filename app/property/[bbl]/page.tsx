"use client";

import { useState, useEffect, FormEvent, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  mapViolation,
  generatePropertySummary,
  CLASS_INFO,
  type MappedViolation,
} from "../../../lib/violation-mappings";
import type {
  Violation,
  Complaint,
  Litigation,
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
        {complaint.type && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${complaint.type === "EMERGENCY" ? "bg-[#3D1414] text-[#FF4D4D]" : "bg-[var(--card-border)] text-[var(--muted)]"}`}>
            {complaint.type}
          </span>
        )}
      </div>
      {complaint.minor_category && (
        <p className="text-xs text-[var(--muted)] mb-1">{titleCase(complaint.minor_category)}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-[var(--muted-dim)]">
        <span>{formatDate(complaint.received_date)}</span>
        {complaint.complaint_status && <span>{titleCase(complaint.complaint_status)}</span>}
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

// ─── Property Page ──────────────────────────────────

function PropertyContent({ bbl }: { bbl: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchedQuery = searchParams.get("q") || "";
  const geoAddress = searchParams.get("address") || "";
  const geoBin = searchParams.get("bin") || "";
  const geoCoords = searchParams.get("coords") || "";

  const [address, setAddress] = useState(searchedQuery);
  const [borough, setBorough] = useState("");
  const [addressLabel, setAddressLabel] = useState(geoAddress);
  const [propertyData, setPropertyData] = useState<PropertyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [timeframe, setTimeframe] = useState<"recent" | "all">("recent");
  const [activeTab, setActiveTab] = useState<"violations" | "complaints" | "litigation">("violations");

  useEffect(() => {
    async function load() {
      setLoadingProperty(true);
      try {
        const params = new URLSearchParams({ bbl });
        if (geoAddress) params.set("address", geoAddress);
        if (geoBin) params.set("bin", geoBin);
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
  }, [bbl]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    if (!/\d/.test(trimmed)) { setError("Please include a street number (e.g. 553 Howard Ave, Brooklyn)"); return; }
    setLoading(true); setError("");
    try {
      const query = borough ? `${trimmed}, ${borough}, NY` : trimmed;
      const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;
      if (!foundBbl) { setError("No results found for that address. Try a valid NYC address."); setLoading(false); return; }
      const label = feature.properties.label || "";
      const foundBin = feature.properties.addendum?.pad?.bin || "";
      const [lng, lat] = feature.geometry?.coordinates || [];
      const coords = lat && lng ? `${lat},${lng}` : "";
      router.push(`/property/${foundBbl}?q=${encodeURIComponent(trimmed)}&address=${encodeURIComponent(label)}&bin=${foundBin}&coords=${coords}`);
    } catch { setError("Something went wrong. Please try again."); setLoading(false); }
  }

  // ─── Derived data ───
  const filteredViolations = useMemo(() => {
    if (!propertyData) return [];
    if (timeframe === "all") return propertyData.violations;
    return propertyData.violations.filter((v) => isRecent(v.inspectiondate));
  }, [propertyData, timeframe]);

  const sortedViolations = useMemo(() =>
    [...filteredViolations].sort((a, b) => (b.inspectiondate ?? "").localeCompare(a.inspectiondate ?? "")),
    [filteredViolations]
  );

  const mappedViolations = useMemo(() =>
    sortedViolations.map((v) => ({ violation: v, mapped: mapViolation(v.novdescription ?? "") })),
    [sortedViolations]
  );

  const summary = useMemo(() => {
    if (!propertyData) return null;
    return generatePropertySummary(
      propertyData.violations.map((v) => ({
        class: v.class,
        novdescription: v.novdescription ?? "",
        inspectiondate: timeframe === "all" ? (v.inspectiondate ?? new Date().toISOString()) : (v.inspectiondate ?? undefined),
      })),
      propertyData.complaint_count,
      propertyData.litigations.length,
      propertyData.vacate_orders.length > 0
    );
  }, [propertyData, timeframe]);

  const topCategories = useMemo(() => getTopCategories(mappedViolations), [mappedViolations]);

  const filteredComplaints = useMemo(() => {
    if (!propertyData) return [];
    const list = timeframe === "recent"
      ? propertyData.complaints.filter((c) => isRecent(c.received_date))
      : propertyData.complaints;
    return [...list].sort((a, b) => (b.received_date ?? "").localeCompare(a.received_date ?? ""));
  }, [propertyData, timeframe]);

  const complaintCategories = useMemo(() => getComplaintCategories(filteredComplaints), [filteredComplaints]);

  const filteredComplaintCount = useMemo(() => {
    return new Set(filteredComplaints.map((c) => c.complaint_id)).size;
  }, [filteredComplaints]);

  const emergencyCount = useMemo(() =>
    filteredComplaints.filter((c) => c.type === "EMERGENCY").length,
    [filteredComplaints]
  );

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

  const landlordQuestions = useMemo(() => generateQuestions(mappedViolations), [mappedViolations]);

  const classCount = (cls: string) => filteredViolations.filter((v) => v.class === cls).length;
  const displayedViolations = mappedViolations.slice(0, visibleCount);
  const timeframeLabel = timeframe === "recent" ? `since ${twoYearsAgoLabel}` : "all time";

  // Registration contacts
  const contacts = useMemo(() => {
    const list = propertyData?.registration_contacts ?? [];
    const byType = (type: string) => list.find((c) => c.type === type);
    return { owner: byType("CorporateOwner"), agent: byType("Agent"), headOfficer: byType("HeadOfficer"), siteManager: byType("SiteManager") };
  }, [propertyData]);

  const buildingDetails = propertyData?.building_details;

  // Ownership from most recent litigation
  const ownerInfo = useMemo(() => {
    if (!propertyData) return null;
    const sorted = [...propertyData.litigations].sort((a, b) => (b.caseopendate ?? "").localeCompare(a.caseopendate ?? ""));
    return sorted[0]?.respondent || null;
  }, [propertyData]);

  // ─── Render ───────────────────────────────────────

  // Detect address mismatch — only compare house numbers
  const addressMismatch = useMemo(() => {
    if (!searchedQuery || !addressLabel) return null;
    const searchedNum = searchedQuery.match(/^\s*(\d+)/)?.[1];
    const returnedNum = addressLabel.match(/^\s*(\d+)/)?.[1];
    if (!searchedNum || !returnedNum) return null;
    if (searchedNum !== returnedNum) return addressLabel;
    return null;
  }, [searchedQuery, addressLabel]);

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)] cursor-pointer" onClick={() => router.push("/")}>Habitable</h1>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address (e.g., 553 Howard Ave, Brooklyn)" className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-dim)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]" />
            <select value={borough} onChange={(e) => setBorough(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]">
              <option value="">Any</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Brooklyn">Brooklyn</option>
              <option value="Queens">Queens</option>
              <option value="Bronx">Bronx</option>
              <option value="Staten Island">Staten Is.</option>
            </select>
            <button type="submit" disabled={loading} className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-40">
              {loading ? "..." : "Search"}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {addressMismatch && (
          <div className="rounded-xl border border-[#2A3545] bg-[#1A2533] px-4 py-3 mb-4 text-sm text-[#6B8CAE]">
            We couldn&apos;t find an exact match for your address. Showing results for <span className="font-semibold text-[var(--foreground)]">{addressMismatch}</span>.
            {geoCoords && (
              <> {" "}
                <a href={`https://www.google.com/maps?q=${geoCoords}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--foreground)]">View on map to verify this is your building</a>
              </>
            )}
          </div>
        )}
        {loadingProperty && <p className="text-center text-sm text-[var(--muted)] py-12">Loading building data...</p>}
        {error && <div className="rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-400">{error}</div>}

        {propertyData && (
          <div className="space-y-5">
            {/* Address header + building info */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">{addressLabel || `Property ${bbl}`}</h2>
                  <p className="text-sm text-[var(--muted-dim)] font-[family-name:var(--font-geist-mono)]">BBL {bbl}</p>
                  {(buildingDetails || propertyData?.nta) && (
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {[
                        buildingDetails?.legal_class_a ? `${buildingDetails.legal_class_a} units` : null,
                        buildingDetails?.legal_stories ? `${buildingDetails.legal_stories} stories` : null,
                        buildingDetails?.dob_building_class ? titleCase(buildingDetails.dob_building_class) : null,
                        propertyData?.nta || null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Link href={`/compare?bbls=${bbl}`} className="shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition-colors">+ Compare</Link>
              </div>
            </div>

            {/* Building Registration */}
            {(contacts.owner || contacts.agent || ownerInfo) && (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-4">
                <h3 className="text-xs font-semibold text-[var(--muted-dim)] uppercase tracking-wide mb-2">Building Registration</h3>
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
              </div>
            )}

            {/* Vacate order banner */}
            {propertyData.vacate_orders.length > 0 && (
              <div className="rounded-xl border-2 border-red-700 bg-red-950 p-5">
                <p className="text-base font-bold text-red-400 mb-1">Active Vacate Order</p>
                <p className="text-sm text-red-300">HPD has declared conditions in this building uninhabitable. Reason: {propertyData.vacate_orders[0].reason ?? "Not specified"}</p>
                {propertyData.vacate_orders[0].effective_date && (
                  <p className="text-xs text-red-400/70 mt-1">Effective {formatDate(propertyData.vacate_orders[0].effective_date)} · {propertyData.vacate_orders[0].units_vacated ?? "?"} units vacated</p>
                )}
              </div>
            )}

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

            {/* Timeframe toggle */}
            <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-1 border border-[var(--card-border)] w-fit">
              <button onClick={() => { setTimeframe("recent"); setVisibleCount(10); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeframe === "recent" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Last 2 years</button>
              <button onClick={() => { setTimeframe("all"); setVisibleCount(10); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeframe === "all" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>All time</button>
            </div>

            {/* Violation class breakdown */}
            {filteredViolations.length > 0 && (
              <div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--foreground)]">{filteredViolations.length}</p>
                    <p className="text-[10px] text-[var(--muted-dim)] mt-0.5">Open</p>
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

            {/* Complaints & litigation summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
                <p className="text-xs text-[var(--muted-dim)] mb-0.5">Complaints ({timeframeLabel})</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {filteredComplaintCount}
                  {filteredComplaints.length !== filteredComplaintCount && (
                    <span className="text-xs font-normal text-[var(--muted-dim)] ml-1">({filteredComplaints.length} issues)</span>
                  )}
                </p>
                {emergencyCount > 0 && <p className="text-[10px] text-[#FF4D4D]">{emergencyCount} emergency</p>}
                {complaintCategories.length > 0 && (
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                    {complaintCategories.slice(0, 3).map((c) => `${titleCase(c.category)} (${c.count})`).join(", ")}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
                <p className="text-xs text-[var(--muted-dim)] mb-0.5">Litigation ({timeframeLabel})</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{filteredLitigations.length}</p>
                {pendingLitigation > 0 && <p className="text-[10px] text-[#FFB020]">{pendingLitigation} pending</p>}
                {litigationTypes.length > 0 && (
                  <p className="text-[10px] text-[var(--muted-dim)] mt-1">
                    {litigationTypes.slice(0, 2).map((t) => `${titleCase(t.type)} (${t.count})`).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Bed Bug History */}
            {filteredBedbugs.length > 0 && (() => {
              const totalInfested = filteredBedbugs.reduce((s, r) => s + (r.infested_unit_count || 0), 0);
              const totalEradicated = filteredBedbugs.reduce((s, r) => s + (r.eradicated_unit_count || 0), 0);
              const hasActive = filteredBedbugs.some((r) => r.infested_unit_count > 0);
              return (
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Bed Bug History</h3>
                  {hasActive ? (
                    <div className="rounded-lg border border-[#3D2E0A] bg-[#2E2810] px-3 py-2 mb-3"><p className="text-sm text-[#FFB020]">Bed bugs have been reported in this building.</p></div>
                  ) : totalInfested === 0 ? (
                    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 mb-3"><p className="text-sm text-[var(--muted)]">No active infestations reported.{totalEradicated > 0 && ` ${totalEradicated} unit${totalEradicated === 1 ? "" : "s"} previously treated.`}</p></div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="text-lg font-bold text-[var(--foreground)]">{filteredBedbugs.length}</p><p className="text-[10px] text-[var(--muted-dim)]">Annual filings</p></div>
                    <div><p className="text-lg font-bold text-[var(--foreground)]">{formatDate(filteredBedbugs[0].filing_date)}</p><p className="text-[10px] text-[var(--muted-dim)]">Most recent filing</p></div>
                    <div><p className="text-lg font-bold text-[var(--foreground)]">{totalEradicated > 0 ? totalEradicated : totalInfested}</p><p className="text-[10px] text-[var(--muted-dim)]">{totalEradicated > 0 ? "Units treated" : "Infested units"}</p></div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Deep Dive Tabs ─── */}
            <div>
              <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-1 border border-[var(--card-border)] w-fit mb-4">
                {(["violations", "complaints", "litigation"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${activeTab === tab ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                    {tab === "violations" ? `Violations (${filteredViolations.length})` : tab === "complaints" ? `Complaints (${filteredComplaints.length})` : `Litigation (${filteredLitigations.length})`}
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
            </div>

            {/* Data freshness + disclaimer */}
            <div className="space-y-2 py-2">
              <div className="text-center text-[10px] text-[var(--muted-dim)]">
                {propertyData.from_cache ? "Cached" : "Last updated"}: {formatDate(propertyData.cached_at)}
              </div>
              <p className="text-center text-[10px] text-[var(--muted-dim)]">
                This report covers HPD housing code violations, complaints, and litigation only. Some issues (gas, fire safety, DOB) are tracked by other agencies.
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

export default function PropertyPage({ params }: { params: { bbl: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <PropertyContent bbl={params.bbl} />
    </Suspense>
  );
}
