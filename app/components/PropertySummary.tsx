"use client";

import type { PropertyResponse } from "../../lib/property-types";
import EntityLink from "./EntityLink";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  propertyData: PropertyResponse;
  addressLabel: string;
  bbl: string;
  neighbourhood: string;
  buildingType: string | null;
  landlordQuestions: { text: string; copyText: string }[];
  deeds: { buyer: string; seller: string; date: string; amount: number }[];
  linkedProperties: { bbl: string; address: string; date: string; confirmed: boolean }[];
  contacts: {
    owner?: { corporation_name: string | null; first_name: string | null; last_name: string | null } | null;
    headOfficer?: { first_name: string | null; last_name: string | null } | null;
  };
}

export default function PropertySummary({
  propertyData,
  addressLabel,
  bbl,
  neighbourhood,
  buildingType,
  landlordQuestions,
  deeds,
  linkedProperties,
  contacts,
}: Props) {
  const summary = propertyData.assessment_summary_recent;
  const vCounts = propertyData.violation_counts?.recent;
  const cCounts = propertyData.complaint_counts?.recent;
  const lCounts = propertyData.litigation_counts?.recent ?? 0;
  const units = propertyData.building_details?.legal_class_a;

  const severity = summary?.severityLevel ?? "clean";
  const hasActiveVacate = propertyData.vacate_orders.some((v) => !v.rescind_date);
  const hasActiveAep = (propertyData.aep_status ?? []).some((a) => a.current_status === "AEP Active");

  // Verdict
  const isSevere = severity === "severe" || hasActiveVacate;
  const isSerious = severity === "serious" || severity === "moderate";
  const verdictText = isSevere
    ? "Do not sign without reading this."
    : isSerious
      ? "Ask a few questions before signing."
      : "No major issues on file.";
  const verdictColor = isSevere
    ? "var(--signal-red)"
    : isSerious
      ? "var(--signal-amber)"
      : "var(--hab-ink)";

  // Stats
  const openViolations = vCounts?.total_open ?? 0;
  const classC = vCounts?.class_c ?? 0;
  const complaintCount = cCounts?.deduped ?? 0;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Owner info
  const ownerName = contacts.owner?.corporation_name
    || [contacts.owner?.first_name, contacts.owner?.last_name].filter(Boolean).join(" ")
    || null;
  const headOfficerName = contacts.headOfficer
    ? [contacts.headOfficer.first_name, contacts.headOfficer.last_name].filter(Boolean).join(" ")
    : null;

  const metaParts = [
    neighbourhood || null,
    `BBL ${bbl}`,
    units ? `${units} units` : null,
    buildingType,
  ].filter(Boolean);

  // Section numbering
  let sectionNum = 0;
  const nextSection = () => ++sectionNum;

  const assessmentNum = nextSection();
  const hasFlagsSection = hasActiveVacate || hasActiveAep;
  const flagsNum = hasFlagsSection ? nextSection() : 0;
  const questionsNum = landlordQuestions.length > 0 ? nextSection() : 0;
  const ownershipNum = nextSection();

  return (
    <div className="max-w-[680px] mx-auto py-8 px-1">
      {/* 1. MASTHEAD */}
      <div className="pb-4 mb-6" style={{ borderBottom: "2px solid var(--hab-ink)" }}>
        <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.08em] text-[var(--hab-muted)] mb-2">
          Habitable Report
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] leading-tight">
              {addressLabel || `Property ${bbl}`}
            </h1>
            <p className="text-sm text-[var(--hab-muted)] mt-1">
              {metaParts.join(" \u00B7 ")}
            </p>
          </div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--hab-muted)] shrink-0 text-right">
            Generated<br />{today}
          </p>
        </div>
      </div>

      {/* 2. VERDICT LINE */}
      <div
        className="pl-4 mb-8"
        style={{ borderLeft: `3px solid ${verdictColor}` }}
      >
        <p className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] leading-snug">
          {verdictText}
        </p>
        {summary?.headline && (
          <p className="text-sm text-[var(--hab-ink-2)] mt-1 leading-relaxed">
            {summary.headline}
          </p>
        )}
      </div>

      {/* 3. FOUR HEADLINE STATS */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { value: openViolations, label: "Open violations", bad: openViolations > 20 },
          { value: classC, label: "Class C", bad: classC > 0 },
          { value: complaintCount, label: "Tenant complaints", bad: complaintCount > 20 },
          { value: lCounts, label: "Active lawsuits", bad: lCounts > 0 },
        ].map((stat) => (
          <div key={stat.label} className="pt-3" style={{ borderTop: "1px solid var(--hab-line)" }}>
            <p
              className="text-2xl font-[family-name:var(--font-serif)] font-semibold"
              style={{ color: stat.bad ? "var(--sev-c)" : "var(--hab-ink)" }}
            >
              {stat.value}
            </p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--hab-muted)] mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* 4. SECTION: Assessment */}
      <div className="mb-8">
        <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)] mb-3">
          &sect; {assessmentNum} &mdash; Assessment
        </p>
        {summary?.details ? (
          <p className="text-sm font-[family-name:var(--font-serif)] text-[var(--hab-ink)] leading-relaxed">
            {summary.details}
          </p>
        ) : (
          <p className="text-sm text-[var(--hab-muted)]">No assessment data available.</p>
        )}
      </div>

      {/* 5. SECTION: Flags on file — only if vacate or AEP active */}
      {hasFlagsSection && (
        <div className="mb-8">
          <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)] mb-3">
            &sect; {flagsNum} &mdash; Flags on file
          </p>
          {hasActiveVacate && (() => {
            const vacate = propertyData.vacate_orders.find((v) => !v.rescind_date);
            return (
              <div className="rounded-lg p-3 mb-2" style={{ background: "var(--banner-red-bg)", border: "1px solid var(--banner-red-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--banner-red-ink)" }}>
                  Active Vacate Order
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--banner-red-ink)" }}>
                  Reason: {vacate?.reason ?? "Not specified"}.
                  {vacate?.effective_date && ` Effective ${formatDate(vacate.effective_date)}.`}
                </p>
              </div>
            );
          })()}
          {hasActiveAep && (() => {
            const allAep = propertyData.aep_status ?? [];
            return (
              <div className="rounded-lg p-3" style={{ background: "var(--banner-amber-bg)", border: "1px solid var(--banner-amber-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--banner-amber-ink)" }}>
                  HPD Watchlist Building (AEP)
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--banner-amber-ink)" }}>
                  This building is on HPD&apos;s Alternative Enforcement Program.
                  {allAep.length > 1 && ` Placed on watchlist ${allAep.length} times.`}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. SECTION: Questions to ask */}
      {landlordQuestions.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)] mb-3">
            &sect; {questionsNum} &mdash; Three questions to ask before you sign
          </p>
          <ol className="space-y-4">
            {landlordQuestions.slice(0, 3).map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-sm font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div>
                  <p className="text-sm font-[family-name:var(--font-serif)] text-[var(--hab-ink)] leading-relaxed">
                    {q.copyText}
                  </p>
                  <p className="text-[11px] text-[var(--hab-muted)] mt-0.5">{q.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 7. SECTION: Ownership */}
      <div className="mb-8">
        <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)] mb-3">
          &sect; {ownershipNum} &mdash; Ownership
        </p>
        {ownerName || deeds.length > 0 ? (
          <p className="text-sm font-[family-name:var(--font-serif)] text-[var(--hab-ink)] leading-relaxed">
            {ownerName && <>Owned by <strong>{contacts.owner?.corporation_name ? <EntityLink name={contacts.owner.corporation_name} /> : ownerName}</strong></>}
            {ownerName && headOfficerName && <>, head officer <strong>{headOfficerName}</strong></>}
            {ownerName && deeds.length > 0 && ". "}
            {deeds.length > 0 && (
              <>
                Purchased {formatDate(deeds[0].date)}
                {deeds[0].amount >= 1000
                  ? ` for $${Math.round(deeds[0].amount).toLocaleString()}`
                  : " (transfer)"}
                .
              </>
            )}
            {linkedProperties.length > 0 && (
              <> The head officer is linked to {linkedProperties.length} other propert{linkedProperties.length === 1 ? "y" : "ies"}.</>
            )}
          </p>
        ) : (
          <p className="text-sm text-[var(--hab-muted)]">Ownership data not available.</p>
        )}
      </div>

      {/* 8. FOOTER */}
      <div
        className="pt-4 flex items-center justify-between"
        style={{ borderTop: "2px solid var(--hab-ink)" }}
      >
        <p className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)]">
          Sources: HPD &middot; ACRIS &middot; DOB &middot; 311
        </p>
        <p className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)]">
          habitable-xi.vercel.app
        </p>
      </div>
    </div>
  );
}
