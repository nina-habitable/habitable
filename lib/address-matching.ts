/**
 * Address normalization and fuzzy match detection.
 * Shared between frontend (PropertyClient, CompareClient, HomeClient)
 * and potentially the API route.
 */

export const KNOWN_BOROUGHS = [
  "manhattan",
  "brooklyn",
  "queens",
  "bronx",
  "staten island",
];

export function normalizeStreet(s: string | undefined | null): string {
  if (!s) return "";
  let result = s.toLowerCase().trim();

  // Strip trailing borough name if present (handles cases where user
  // typed "howard ave brooklyn" without a comma)
  for (const borough of KNOWN_BOROUGHS) {
    const re = new RegExp(`\\s+${borough}\\s*$`);
    result = result.replace(re, "");
  }

  // Normalize common street type abbreviations so "ave" matches "avenue"
  result = result
    .replace(/\bave(nue)?\b\.?/g, "avenue")
    .replace(/\bst(reet)?\b\.?/g, "street")
    .replace(/\brd\.?\b/g, "road")
    .replace(/\bblvd\.?\b/g, "boulevard")
    .replace(/\bpl(ace)?\b\.?/g, "place")
    .replace(/\bdr(ive)?\b\.?/g, "drive")
    .replace(/\bln\.?\b/g, "lane")
    .replace(/\bct\.?\b/g, "court")
    .replace(/\bpkwy\.?\b/g, "parkway")
    .replace(/\s+/g, " ")
    .trim();

  return result;
}

export function extractBoroughFromInput(s: string): string {
  const lower = s.toLowerCase();
  // Try the after-comma form first
  const afterComma = lower.split(",")[1]?.trim();
  if (afterComma) {
    for (const borough of KNOWN_BOROUGHS) {
      if (afterComma.includes(borough)) return borough;
    }
  }
  // Try trailing borough form (no comma)
  for (const borough of KNOWN_BOROUGHS) {
    const re = new RegExp(`\\s+${borough}\\s*$`);
    if (re.test(lower)) return borough;
  }
  return "";
}

export interface FuzzyMatchResult {
  searched_address: string;
  matched_address: string;
}

/**
 * Compare a user's typed address against the Geosearch result.
 * Returns { searched_address, matched_address } if any component
 * (house number, street, borough) differs after normalization.
 * Returns null if the match is close enough.
 */
export function detectFuzzyMatch(
  typedInput: string,
  resolvedFeature: {
    housenumber?: string;
    street?: string;
    borough?: string;
    label?: string;
  }
): FuzzyMatchResult | null {
  const searchedNum = typedInput.match(/^\s*(\d[\d-]*)/)?.[1] || "";
  const matchedNum = (resolvedFeature.housenumber || "").match(/^\d[\d-]*/)?.[0] || "";

  const afterNum = typedInput.replace(/^\s*\d[\d-]*\s*/, "");
  const rawSearchedStreet = (afterNum.split(",")[0] || "");
  const searchedStreet = normalizeStreet(rawSearchedStreet);
  const matchedStreet = normalizeStreet(resolvedFeature.street);

  const searchedBorough = extractBoroughFromInput(typedInput);
  const matchedBorough = (resolvedFeature.borough || "").toLowerCase().trim();

  let isMismatch = false;
  if (searchedNum && matchedNum && searchedNum !== matchedNum) isMismatch = true;
  if (searchedStreet && matchedStreet && searchedStreet !== matchedStreet) isMismatch = true;
  if (searchedBorough && matchedBorough && searchedBorough !== matchedBorough) isMismatch = true;

  if (isMismatch) {
    return {
      searched_address: typedInput,
      matched_address:
        resolvedFeature.label ||
        `${resolvedFeature.housenumber} ${resolvedFeature.street}`,
    };
  }

  return null;
}
