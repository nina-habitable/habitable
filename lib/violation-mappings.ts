/**
 * Habitable — Plain-English Violation Mapping Table
 *
 * How this works:
 * Every HPD violation has a "novdescription" field with the raw legal text.
 * This table matches keywords in that text and returns a human-readable version.
 *
 * The matcher checks patterns in order — first match wins.
 * Each pattern has:
 *   - keywords: array of strings that must ALL appear in the description (case-insensitive)
 *   - title: short plain-English title for the violation card
 *   - explanation: 1-2 sentence explanation a renter can understand
 *   - icon: emoji for visual scanning (optional, for UI)
 *   - severity: "critical" | "high" | "medium" | "low" — layered on TOP of the class badge
 *
 * The class badge (A/B/C/I) comes from the violation data itself, not this table.
 * Severity here is about the CATEGORY of problem, not the legal class.
 */

export interface ViolationMapping {
  id: string;
  keywords: string[];
  title: string;
  explanation: string;
  icon: string;
  severity: "critical" | "high" | "medium" | "low";
}

export const VIOLATION_MAPPINGS: ViolationMapping[] = [

  // ═══════════════════════════════════════════
  // CRITICAL — Immediately dangerous conditions
  // ═══════════════════════════════════════════

  {
    id: "lead-paint",
    keywords: ["LEAD"],
    title: "Lead paint hazard",
    explanation: "Lead-based paint was found in this unit or building. Lead paint is especially dangerous for young children and pregnant women. The landlord is required to safely remove or contain it.",
    icon: "⚠️",
    severity: "critical",
  },
  {
    id: "vacate",
    keywords: ["VACATE"],
    title: "Vacate order issued",
    explanation: "HPD has ordered occupants to leave part or all of this building due to unsafe conditions. This is the most serious enforcement action HPD can take.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "fire-escape-blocked",
    keywords: ["FIRE ESCAPE", "OBSTR"],
    title: "Fire escape obstruction",
    explanation: "The fire escape is blocked or obstructed. This is a life-safety issue — fire escapes must be clear and accessible at all times.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "carbon-monoxide",
    keywords: ["CARBON MONOXIDE"],
    title: "Carbon monoxide detector missing",
    explanation: "A required carbon monoxide detector is missing or not working. CO is an odorless, deadly gas — detectors are required by law in every apartment.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "smoke-detector",
    keywords: ["SMOKE DETECT"],
    title: "Smoke detector missing or defective",
    explanation: "A required smoke detector is missing, not working, or improperly installed. Smoke detectors are required by law in every apartment.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "gas-supply",
    keywords: ["GAS SUPPLY"],
    title: "Gas supply issue",
    explanation: "There is a problem with the gas supply to this building or unit. Gas issues can pose explosion or carbon monoxide risks.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "structural",
    keywords: ["STRUCTUR"],
    title: "Structural issue",
    explanation: "A structural problem was found in the building — this could involve walls, floors, ceilings, or the building's foundation. Structural issues can indicate serious safety concerns.",
    icon: "🚨",
    severity: "critical",
  },
  {
    id: "illegal-occupancy",
    keywords: ["ILLEGAL OCCUPANCY"],
    title: "Illegal occupancy",
    explanation: "Part of this building is being used in a way that violates its certificate of occupancy. This can mean unsafe living conditions in spaces not designed for residents.",
    icon: "🚨",
    severity: "critical",
  },

  // ═══════════════════════════════════════════
  // HIGH — Serious habitability issues
  // ═══════════════════════════════════════════

  {
    id: "no-heat",
    keywords: ["HEAT"],
    title: "Heat failure",
    explanation: "The building failed to provide required heat. NYC law requires landlords to keep apartments at 68°F during the day and 62°F at night from October through May.",
    icon: "🔥",
    severity: "high",
  },
  {
    id: "hot-water",
    keywords: ["HOT WATER"],
    title: "Hot water failure",
    explanation: "The building failed to provide adequate hot water. Landlords are required to supply hot water at 120°F minimum, 24 hours a day, year-round.",
    icon: "🔥",
    severity: "high",
  },
  {
    id: "water-leak",
    keywords: ["WATER LEAK"],
    title: "Water leak",
    explanation: "Water is leaking into an apartment — from the ceiling, walls, or pipes. The landlord must find and fix the source. Ongoing leaks can cause mold and structural damage.",
    icon: "💧",
    severity: "high",
  },
  {
    id: "mold",
    keywords: ["MOLD"],
    title: "Mold condition",
    explanation: "Mold was found in this unit or building. Mold can cause respiratory problems and allergic reactions. The landlord is required to remediate mold and fix the underlying moisture source.",
    icon: "🦠",
    severity: "high",
  },
  {
    id: "vermin-rats",
    keywords: ["RAT", "MICE", "MOUSE", "RODENT"],
    title: "Rodent infestation",
    explanation: "Rats or mice were found in the building. The landlord is required to hire a licensed exterminator and seal entry points.",
    icon: "🐀",
    severity: "high",
  },
  {
    id: "vermin-roaches",
    keywords: ["ROACH"],
    title: "Roach infestation",
    explanation: "Cockroaches were found in the building. The landlord is required to provide regular extermination services.",
    icon: "🪳",
    severity: "high",
  },
  {
    id: "vermin-general",
    keywords: ["VERMIN"],
    title: "Pest infestation",
    explanation: "Pests were found in the building. The landlord is required to hire an exterminator and address the conditions allowing pests.",
    icon: "🪳",
    severity: "high",
  },
  {
    id: "bed-bugs",
    keywords: ["BED BUG"],
    title: "Bed bug infestation",
    explanation: "Bed bugs were reported or found in this building. The landlord must hire a licensed exterminator. Bed bugs spread easily between units.",
    icon: "🪳",
    severity: "high",
  },
  {
    id: "electricity",
    keywords: ["ELECTRIC"],
    title: "Electrical issue",
    explanation: "An electrical problem was found — this could involve wiring, outlets, or fixtures. Electrical issues can pose fire and shock hazards.",
    icon: "⚡",
    severity: "high",
  },
  {
    id: "plumbing",
    keywords: ["PLUMBING"],
    title: "Plumbing failure",
    explanation: "A plumbing problem was found in this unit or building. This could affect water supply, drainage, or sewage. The landlord must repair it.",
    icon: "🔧",
    severity: "high",
  },
  {
    id: "sewage",
    keywords: ["SEWAGE"],
    title: "Sewage issue",
    explanation: "A sewage problem was found. This is a serious health hazard that the landlord must address immediately.",
    icon: "🔧",
    severity: "high",
  },

  // ═══════════════════════════════════════════
  // MEDIUM — Maintenance and repair issues
  // ═══════════════════════════════════════════

  {
    id: "window-guard",
    keywords: ["WINDOW GUARD"],
    title: "Window guard missing",
    explanation: "A required window guard is missing. NYC law requires window guards in apartments where children under 11 live, and in all apartments upon request.",
    icon: "🪟",
    severity: "medium",
  },
  {
    id: "fire-escape-repair",
    keywords: ["FIRE ESCAPE"],
    title: "Fire escape repair needed",
    explanation: "The fire escape needs repair or maintenance. Fire escapes must be structurally sound and accessible.",
    icon: "🪜",
    severity: "medium",
  },
  {
    id: "door-lock",
    keywords: ["DOOR", "LOCK"],
    title: "Door or lock defective",
    explanation: "A door or lock is broken or defective. The landlord must maintain secure, working locks on all entry doors.",
    icon: "🔒",
    severity: "medium",
  },
  {
    id: "latch-entrance",
    keywords: ["LATCH"],
    title: "Defective latch or lock",
    explanation: "A latch on a door or entrance is broken. Building entrances must have working, self-closing doors with functional latches for security.",
    icon: "🔒",
    severity: "medium",
  },
  {
    id: "intercom-buzzer",
    keywords: ["INTERCOM"],
    title: "Intercom or buzzer broken",
    explanation: "The building intercom or buzzer system is not working. Landlords must maintain a working intercom so tenants can buzz in visitors.",
    icon: "🔔",
    severity: "medium",
  },
  {
    id: "paint-peeling",
    keywords: ["PAINT", "PEEL"],
    title: "Peeling paint",
    explanation: "Paint is peeling in the apartment or common areas. In buildings built before 1978, peeling paint may contain lead and requires safe removal procedures.",
    icon: "🎨",
    severity: "medium",
  },
  {
    id: "paint-general",
    keywords: ["PAINT"],
    title: "Paint condition",
    explanation: "A paint condition was cited — peeling, cracking, or missing paint. The landlord must repaint and address any underlying cause like moisture.",
    icon: "🎨",
    severity: "medium",
  },
  {
    id: "floor-repair",
    keywords: ["FLOOR"],
    title: "Floor repair needed",
    explanation: "Flooring is damaged, defective, or missing. The landlord must maintain floors in safe, sanitary condition.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "ceiling-repair",
    keywords: ["CEILING"],
    title: "Ceiling repair needed",
    explanation: "The ceiling is damaged — this could be cracking, sagging, holes, or water damage. The landlord must repair it and fix any underlying cause.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "wall-repair",
    keywords: ["WALL", "REPAIR"],
    title: "Wall repair needed",
    explanation: "Walls are damaged or have holes. The landlord must maintain walls in good condition — holes can let in pests and compromise fire separation between units.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "toilet",
    keywords: ["TOILET"],
    title: "Toilet issue",
    explanation: "The toilet is broken, leaking, or defective. The landlord must maintain working plumbing fixtures.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "sink",
    keywords: ["SINK"],
    title: "Sink issue",
    explanation: "A sink is broken, leaking, or defective. The landlord must maintain working plumbing fixtures in kitchens and bathrooms.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "bathtub-shower",
    keywords: ["BATHTUB"],
    title: "Bathtub or shower issue",
    explanation: "The bathtub or shower is broken, leaking, or defective. The landlord must maintain working bathing facilities.",
    icon: "🔧",
    severity: "medium",
  },
  {
    id: "elevator",
    keywords: ["ELEVATOR"],
    title: "Elevator issue",
    explanation: "The building elevator is broken or not properly maintained. Buildings with elevators are required to keep them in safe, working order.",
    icon: "🛗",
    severity: "medium",
  },
  {
    id: "lighting",
    keywords: ["LIGHT"],
    title: "Lighting issue",
    explanation: "Lighting is inadequate or broken in the apartment or common areas. Landlords must provide and maintain adequate lighting in hallways, stairs, and building entrances.",
    icon: "💡",
    severity: "medium",
  },
  {
    id: "stairway",
    keywords: ["STAIR"],
    title: "Stairway issue",
    explanation: "A stairway or banister needs repair. Stairways must be kept in safe condition with proper railings and adequate lighting.",
    icon: "🪜",
    severity: "medium",
  },
  {
    id: "garbage",
    keywords: ["GARBAGE", "REFUSE"],
    title: "Garbage or sanitation issue",
    explanation: "The building has a garbage removal or sanitation problem. Landlords must provide adequate trash receptacles and regular removal.",
    icon: "🗑️",
    severity: "medium",
  },
  {
    id: "mailbox",
    keywords: ["MAILBOX"],
    title: "Mailbox issue",
    explanation: "Mailboxes are missing, broken, or not secure. The landlord must provide and maintain individual locked mailboxes for each unit.",
    icon: "📬",
    severity: "medium",
  },

  // ═══════════════════════════════════════════
  // LOW — Administrative / informational
  // ═══════════════════════════════════════════

  {
    id: "registration",
    keywords: ["REGISTRATION", "FAILED TO FILE"],
    title: "Owner failed to register with HPD",
    explanation: "The building owner did not file the required annual registration with HPD. This is an administrative violation — it means HPD may not have current contact information for the landlord.",
    icon: "📋",
    severity: "low",
  },
  {
    id: "bedbug-report",
    keywords: ["BEDBUG REPORT", "BED BUG REPORT"],
    title: "Missing annual bed bug report",
    explanation: "The landlord failed to file the required annual bed bug history report. NYC law requires landlords to disclose bed bug history to prospective tenants.",
    icon: "📋",
    severity: "low",
  },
  {
    id: "posted-notice",
    keywords: ["POST", "NOTICE"],
    title: "Required notice not posted",
    explanation: "A legally required notice is not posted in the building. This could be the emergency contact info, the heating schedule, or other required disclosures.",
    icon: "📋",
    severity: "low",
  },
];

// ═══════════════════════════════════════════
// MATCHING FUNCTION
// ═══════════════════════════════════════════

export interface MappedViolation {
  title: string;
  explanation: string;
  icon: string;
  severity: "critical" | "high" | "medium" | "low";
  matchedPattern: string; // the mapping ID that matched
}

/**
 * Match a raw HPD violation description to a plain-English mapping.
 * Returns the first matching pattern, or a cleaned-up fallback.
 */
export function mapViolation(novdescription: string): MappedViolation {
  const upper = novdescription.toUpperCase();

  for (const mapping of VIOLATION_MAPPINGS) {
    const allMatch = mapping.keywords.every(kw => upper.includes(kw));
    if (allMatch) {
      return {
        title: mapping.title,
        explanation: mapping.explanation,
        icon: mapping.icon,
        severity: mapping.severity,
        matchedPattern: mapping.id,
      };
    }
  }

  // ═══════════════════════════════════════════
  // FALLBACK: Clean up the raw description
  // ═══════════════════════════════════════════
  let cleaned = novdescription;

  const colonIndex = cleaned.search(/(?:HMC|ADM CODE|M\/D LAW|MULT\.\s*DWELL\.\s*LAW)[:\s]/i);
  if (colonIndex !== -1) {
    const afterCode = cleaned.substring(colonIndex);
    const actualColon = afterCode.indexOf(':');
    if (actualColon !== -1) {
      cleaned = afterCode.substring(actualColon + 1).trim();
    } else {
      cleaned = afterCode.replace(/^(HMC|ADM CODE|M\/D LAW|MULT\.\s*DWELL\.\s*LAW)\s*/i, '').trim();
    }
  }

  const locationCut = cleaned.search(/\b(IN THE|AT THE|LOCATED AT|AT APT|IN APT|,\s*\d)/i);
  const shortTitle = locationCut > 10
    ? cleaned.substring(0, locationCut).trim()
    : cleaned.substring(0, 60).trim();

  const titleCased = shortTitle.charAt(0).toUpperCase() + shortTitle.slice(1).toLowerCase();

  return {
    title: titleCased.length > 60 ? titleCased.substring(0, 57) + "..." : titleCased,
    explanation: "A housing code violation was found. The landlord has been ordered to correct this condition.",
    icon: "📌",
    severity: "medium",
    matchedPattern: "fallback",
  };
}

// ═══════════════════════════════════════════
// CLASS BADGE METADATA
// ═══════════════════════════════════════════

export const CLASS_INFO: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  deadline: string;
  description: string;
}> = {
  "A": {
    label: "Non-hazardous",
    color: "#633806",
    bgColor: "#FAEEDA",
    deadline: "90 days to correct",
    description: "Not immediately dangerous, but still a code violation.",
  },
  "B": {
    label: "Hazardous",
    color: "#712B13",
    bgColor: "#FAECE7",
    deadline: "30 days to correct",
    description: "Hazardous to health or safety. Must be fixed within 30 days.",
  },
  "C": {
    label: "Immediately hazardous",
    color: "#791F1F",
    bgColor: "#FCEBEB",
    deadline: "24 hours to correct",
    description: "Immediately dangerous. The landlord has 24 hours to fix this.",
  },
  "I": {
    label: "Order / information",
    color: "#444441",
    bgColor: "#F1EFE8",
    deadline: "Varies",
    description: "An administrative order or informational notice from HPD.",
  },
};

// ═══════════════════════════════════════════
// PROPERTY SUMMARY GENERATOR
// ═══════════════════════════════════════════

export interface PropertySummary {
  headline: string;
  details: string;
  severityLevel: "clean" | "minor" | "moderate" | "serious" | "severe";
}

/**
 * Generate a plain-English summary for a property based on its violation data.
 */
export function generatePropertySummary(
  violations: Array<{ class: string; novdescription: string }>,
  complaintCount: number,
  litigationCount: number,
  hasVacateOrder: boolean,
): PropertySummary {

  const total = violations.length;
  const classC = violations.filter(v => v.class === "C").length;
  const classB = violations.filter(v => v.class === "B").length;

  const mapped = violations.map(v => mapViolation(v.novdescription));
  const criticalCount = mapped.filter(m => m.severity === "critical").length;

  let severityLevel: PropertySummary["severityLevel"];
  if (hasVacateOrder || total > 200 || classC > 50) {
    severityLevel = "severe";
  } else if (total > 50 || classC > 10 || criticalCount > 5) {
    severityLevel = "serious";
  } else if (total > 10 || classC > 2) {
    severityLevel = "moderate";
  } else if (total > 0) {
    severityLevel = "minor";
  } else {
    severityLevel = "clean";
  }

  let headline: string;
  let details: string;

  if (severityLevel === "clean") {
    headline = "This building has no open violations with HPD.";
    details = "No housing code violations are currently on record. This is a positive sign — but violations are only one part of the picture. Consider checking complaint history and talking to current tenants.";
  } else if (severityLevel === "minor") {
    headline = `This building has ${total} open violation${total === 1 ? '' : 's'} — a relatively light record.`;
    details = classC > 0
      ? `${classC} of these ${classC === 1 ? 'is' : 'are'} Class C (immediately hazardous). Even a small number of Class C violations is worth asking the landlord about before signing.`
      : "None are classified as immediately hazardous. This is a relatively clean record, but it's always worth asking the landlord about any open items.";
  } else if (severityLevel === "moderate") {
    headline = `This building has ${total} open violations — more than average for its type.`;
    const topIssues = getTopIssueCategories(mapped);
    details = `The most common issues are ${topIssues}. ${classC} ${classC === 1 ? 'is' : 'are'} Class C (immediately hazardous — landlord had 24 hours to fix). Ask the landlord specifically what's been done about these.`;
  } else if (severityLevel === "serious") {
    headline = `This building has ${total} open violations — significantly above average.`;
    const topIssues = getTopIssueCategories(mapped);
    details = `${classC} are Class C (immediately hazardous) and ${classB} are Class B (hazardous). The most common issues are ${topIssues}.${litigationCount > 0 ? ` HPD has ${litigationCount} litigation case${litigationCount === 1 ? '' : 's'} against this building.` : ''} Consider this a serious red flag — ask the landlord hard questions and consider alternatives.`;
  } else {
    headline = hasVacateOrder
      ? `HPD has issued a vacate order for this building. This means conditions are uninhabitable.`
      : `This building has ${total} open violations — a severely troubled record.`;
    details = `${classC} are Class C (immediately hazardous) and ${classB} are Class B (hazardous).${complaintCount > 0 ? ` Tenants have filed ${complaintCount} complaints.` : ''}${litigationCount > 0 ? ` HPD has ${litigationCount} active litigation case${litigationCount === 1 ? '' : 's'}.` : ''} This building shows a pattern of serious neglect. Proceed with extreme caution.`;
  }

  return { headline, details, severityLevel };
}

function getTopIssueCategories(mapped: MappedViolation[]): string {
  const categoryCounts: Record<string, number> = {};
  for (const m of mapped) {
    categoryCounts[m.title] = (categoryCounts[m.title] || 0) + 1;
  }
  const sorted = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (sorted.length === 0) return "general maintenance issues";
  if (sorted.length === 1) return sorted[0][0].toLowerCase();
  if (sorted.length === 2) return `${sorted[0][0].toLowerCase()} and ${sorted[1][0].toLowerCase()}`;
  return `${sorted[0][0].toLowerCase()}, ${sorted[1][0].toLowerCase()}, and ${sorted[2][0].toLowerCase()}`;
}
