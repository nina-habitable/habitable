/**
 * Habitable Score — percentile-based building comparison.
 * Hidden behind SHOW_HABITABLE_SCORE feature flag until legal review.
 */

import thresholds from "../scripts/score-thresholds.json";
import type { PropertyResponse } from "./property-types";

export const SHOW_HABITABLE_SCORE = true;

// Same closed statuses as the property page
const CLOSED_STATUSES = new Set([
  "VIOLATION CLOSED", "VIOLATION DISMISSED", "NOV CERTIFIED LATE",
  "NOV CERTIFIED ON TIME", "INFO NOV SENT OUT", "LEAD DOCS SUBMITTED, ACCEPTABLE",
  "CERTIFICATION POSTPONEMENT GRANTED",
]);

function isOpen(status: string | null): boolean {
  if (!status) return true;
  return !CLOSED_STATUSES.has(status.toUpperCase());
}

interface CleanResult { type: "clean"; tier: 1 | 2; message: string }
interface ScoreResult {
  type: "score";
  percentile: number;
  violPerUnit: number;
  peerCount: number;
  bucketLabel: string;
}
interface NoScoreResult { type: "no_score"; reason: "aep" | "missing_data" }

export type HabitableScoreResult = CleanResult | ScoreResult | NoScoreResult;

const BUCKET_RANGES: { label: string; min: number; max: number }[] = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-25", min: 11, max: 25 },
  { label: "26-50", min: 26, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-200", min: 101, max: 200 },
  { label: "201+", min: 201, max: Infinity },
];

const PERCENTILE_KEYS = ["p10", "p25", "p50", "p75", "p90", "p95"] as const;
const PERCENTILE_VALUES = [10, 25, 50, 75, 90, 95];

function getBucket(units: number) {
  for (const b of BUCKET_RANGES) {
    if (units >= b.min && units <= b.max) return b.label;
  }
  return "201+";
}

/**
 * Interpolate where a value falls in the percentile distribution.
 * Returns a "percentile worst" — higher = worse building.
 */
function interpolatePercentile(
  value: number,
  dist: Record<string, number>
): number {
  if (value <= 0) return 50; // at or below median

  const vals = PERCENTILE_KEYS.map((k) => dist[k]);

  // Below p10
  if (value <= vals[0]) return 10;

  // Above p95
  if (value >= vals[5]) return 98;

  // Find the two thresholds the value falls between
  for (let i = 0; i < vals.length - 1; i++) {
    if (value >= vals[i] && value <= vals[i + 1]) {
      const lo = vals[i];
      const hi = vals[i + 1];
      if (hi === lo) return PERCENTILE_VALUES[i];
      const frac = (value - lo) / (hi - lo);
      return PERCENTILE_VALUES[i] + frac * (PERCENTILE_VALUES[i + 1] - PERCENTILE_VALUES[i]);
    }
  }

  return 95;
}

function isRecentDate(dateStr: string | null, twoYearsAgo: Date): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) >= twoYearsAgo;
}

export function calculateHabitableScore(
  propertyData: PropertyResponse,
  timeframe: "recent" | "all"
): HabitableScoreResult {
  const units = propertyData.building_details?.legal_class_a;
  if (!units || units <= 0) {
    return { type: "no_score", reason: "missing_data" };
  }

  // Active AEP
  const hasActiveAep = (propertyData.aep_status ?? []).some(
    (a) => a.current_status === "AEP Active"
  );
  if (hasActiveAep) {
    return { type: "no_score", reason: "aep" };
  }

  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
  const isInTimeframe = (d: string | null) =>
    timeframe === "all" ? true : isRecentDate(d, twoYearsAgo);

  // Count open violations in timeframe
  const openViolations = propertyData.violations.filter(
    (v) => isOpen(v.status) && isInTimeframe(v.inspectiondate)
  );
  const classCCount = openViolations.filter((v) => v.class === "C").length;

  // Complaints in timeframe
  const complaints = propertyData.complaints.filter(
    (c) => isInTimeframe(c.received_date)
  );
  const complaintCount = new Set(complaints.map((c) => c.complaint_id)).size;

  // Litigation in timeframe
  const litigationCount = propertyData.litigations.filter(
    (l) => isInTimeframe(l.caseopendate)
  ).length;

  // Bed bug infestations in timeframe
  const bedbugInfestations = (propertyData.bedbug_reports ?? []).filter(
    (r) => r.infested_unit_count > 0 && isInTimeframe(r.filing_date)
  ).length;

  // Discharged AEP
  const hasDischarged = (propertyData.aep_status ?? []).some(
    (a) => a.current_status !== "AEP Active"
  );

  // Clean check — no open violations
  if (openViolations.length === 0) {
    // Count closed violations in timeframe
    const closedViolations = propertyData.violations.filter(
      (v) => !isOpen(v.status) && isInTimeframe(v.inspectiondate)
    ).length;
    // Total complaints in timeframe (open + closed)
    const totalComplaints = complaintCount;

    if (closedViolations === 0 && totalComplaints === 0 && litigationCount === 0 && bedbugInfestations === 0) {
      // Tier 1: nothing on record
      const period = timeframe === "recent" ? " in the last 2 years" : "";
      return { type: "clean", tier: 1, message: `Clean record — no violations, complaints, or litigation${period}` };
    }

    // Tier 2: all issues resolved — build message
    const parts: string[] = [];
    if (closedViolations > 0) parts.push(`${closedViolations} violation${closedViolations === 1 ? " was" : "s were"} issued and closed`);
    if (totalComplaints > 0) parts.push(`${totalComplaints} complaint${totalComplaints === 1 ? " was" : "s were"} filed`);
    if (litigationCount > 0) parts.push(`${litigationCount} litigation case${litigationCount === 1 ? " was" : "s were"} resolved`);
    const period = timeframe === "recent" ? " in the last 2 years" : "";
    const detail = parts.length > 0 ? ` — ${parts.join(" and ")}${period}` : period;
    return { type: "clean", tier: 2, message: `No open violations${detail}` };
  }

  // Calculate score
  const bucketLabel = getBucket(units);
  const bucket = (thresholds.buckets as Record<string, {
    count: number;
    violations_per_unit: Record<string, number>;
    class_c_per_unit: Record<string, number>;
    complaints_per_unit: Record<string, number>;
  }>)[bucketLabel];

  if (!bucket) return { type: "no_score", reason: "missing_data" };

  const violPerUnit = openViolations.length / units;
  const classCPerUnit = classCCount / units;
  const complaintsPerUnit = complaintCount / units;

  // Percentile worst for each metric
  const violPct = interpolatePercentile(violPerUnit, bucket.violations_per_unit);
  const classCPct = interpolatePercentile(classCPerUnit, bucket.class_c_per_unit);
  const complaintPct = interpolatePercentile(complaintsPerUnit, bucket.complaints_per_unit);
  const litigationPct = litigationCount > 0 ? 90 : 50;
  const aepPct = hasDischarged ? 75 : 50;
  const bedbugPct = bedbugInfestations > 0 ? 80 : 50;

  // Weighted combination
  const combinedWorst =
    violPct * 0.30 +
    classCPct * 0.25 +
    complaintPct * 0.15 +
    litigationPct * 0.10 +
    aepPct * 0.15 +
    bedbugPct * 0.05;

  // Convert to "better than X%"
  const percentile = Math.round(Math.max(1, Math.min(99, 100 - combinedWorst)));

  return {
    type: "score",
    percentile,
    violPerUnit: Math.round(violPerUnit * 100) / 100,
    peerCount: bucket.count,
    bucketLabel,
  };
}
