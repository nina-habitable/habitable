import { describe, it, expect } from "vitest";
import {
  isOpenViolation,
  requiresAction,
  isRecent,
  CLOSED_STATUSES,
  ACTION_REQUIRED_STATUSES,
} from "./violation-filters";

describe("isOpenViolation", () => {
  // TEST 1 — returns false for each of the 7 closed statuses
  const closedStatuses = [
    "VIOLATION CLOSED",
    "VIOLATION DISMISSED",
    "NOV CERTIFIED LATE",
    "NOV CERTIFIED ON TIME",
    "INFO NOV SENT OUT",
    "LEAD DOCS SUBMITTED, ACCEPTABLE",
    "CERTIFICATION POSTPONEMENT GRANTED",
  ];

  it.each(closedStatuses)(
    'returns false for closed status "%s"',
    (status) => {
      expect(isOpenViolation(status)).toBe(false);
    }
  );

  // TEST 2 — returns true for "NOV SENT OUT" (open status, not "INFO NOV SENT OUT")
  it('returns true for "NOV SENT OUT" (an open status)', () => {
    expect(isOpenViolation("NOV SENT OUT")).toBe(true);
  });

  // TEST 3 — returns true for arbitrary non-closed statuses
  it("returns true for non-closed statuses", () => {
    expect(isOpenViolation("NOT COMPLIED WITH")).toBe(true);
    expect(isOpenViolation("DEFECT LETTER ISSUED")).toBe(true);
    expect(isOpenViolation("VIOLATION OPEN")).toBe(true);
  });

  // Verify constants are exported correctly
  it("CLOSED_STATUSES has exactly 7 entries", () => {
    expect(CLOSED_STATUSES).toHaveLength(7);
  });
});

describe("requiresAction", () => {
  // TEST 4 — returns true for each of the 6 action-required statuses
  const actionStatuses = [
    "NOT COMPLIED WITH",
    "INVALID CERTIFICATION",
    "SECOND NO ACCESS TO RE-INSPECT VIOLATION",
    "FALSE CERTIFICATION",
    "DEFECT LETTER ISSUED",
    "VIOLATION WILL BE REINSPECTED",
  ];

  it.each(actionStatuses)(
    'returns true for action-required status "%s"',
    (status) => {
      expect(requiresAction(status)).toBe(true);
    }
  );

  // TEST 5 — returns false for non-action statuses
  it("returns false for VIOLATION CLOSED and VIOLATION OPEN", () => {
    expect(requiresAction("VIOLATION CLOSED")).toBe(false);
    expect(requiresAction("VIOLATION OPEN")).toBe(false);
  });

  // Verify constants are exported correctly
  it("ACTION_REQUIRED_STATUSES has exactly 6 entries", () => {
    expect(ACTION_REQUIRED_STATUSES).toHaveLength(6);
  });
});

describe("isRecent", () => {
  const ref = new Date("2026-04-20T00:00:00.000Z");

  // TEST 6 — returns true for a date 1 year ago
  it("returns true for a date 1 year before referenceDate", () => {
    expect(isRecent("2025-04-20T00:00:00.000Z", ref)).toBe(true);
  });

  // TEST 7 — returns false for a date 3 years ago
  it("returns false for a date 3 years before referenceDate", () => {
    expect(isRecent("2023-04-20T00:00:00.000Z", ref)).toBe(false);
  });

  // TEST 8 — returns false for null, undefined, and empty string
  it("returns false for null, undefined, and empty string", () => {
    expect(isRecent(null, ref)).toBe(false);
    expect(isRecent(undefined, ref)).toBe(false);
    expect(isRecent("", ref)).toBe(false);
  });

  // TEST 9 — uses referenceDate parameter
  it("uses the provided referenceDate rather than current date", () => {
    const customRef = new Date("2021-06-01T00:00:00.000Z");
    // 2020-01-01 is ~17 months before 2021-06-01, which is less than 2 years
    expect(isRecent("2020-01-01T00:00:00.000Z", customRef)).toBe(true);
  });
});
