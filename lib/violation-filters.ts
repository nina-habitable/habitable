/**
 * Centralized violation status filters and time utilities.
 * Single source of truth for what counts as "open", "closed", or "requires action".
 */

export const CLOSED_STATUSES = [
  "VIOLATION CLOSED",
  "VIOLATION DISMISSED",
  "NOV CERTIFIED LATE",
  "NOV CERTIFIED ON TIME",
  "INFO NOV SENT OUT",
  "LEAD DOCS SUBMITTED, ACCEPTABLE",
  "CERTIFICATION POSTPONEMENT GRANTED",
] as const;

export const ACTION_REQUIRED_STATUSES = [
  "NOT COMPLIED WITH",
  "INVALID CERTIFICATION",
  "SECOND NO ACCESS TO RE-INSPECT VIOLATION",
  "FALSE CERTIFICATION",
  "DEFECT LETTER ISSUED",
  "VIOLATION WILL BE REINSPECTED",
] as const;

const closedSet = new Set<string>(CLOSED_STATUSES);
const actionSet = new Set<string>(ACTION_REQUIRED_STATUSES);

/**
 * Returns true if the violation status is NOT in the closed statuses list.
 * A null/undefined status is treated as open (conservative approach).
 */
export function isOpenViolation(status: string | null | undefined): boolean {
  if (!status) return true;
  return !closedSet.has(status.toUpperCase());
}

/**
 * Returns true if the violation status indicates the landlord has
 * definitively failed to fix the problem.
 */
export function requiresAction(status: string | null | undefined): boolean {
  if (!status) return false;
  return actionSet.has(status.toUpperCase());
}

export const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/**
 * Returns true if dateStr is within the last 2 years relative to referenceDate.
 * @param dateStr - ISO date string to check
 * @param referenceDate - "now" for the comparison (defaults to new Date())
 */
export function isRecent(
  dateStr: string | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  if (!dateStr) return false;
  const cutoff = new Date(referenceDate.getTime() - TWO_YEARS_MS);
  return dateStr >= cutoff.toISOString();
}
