#!/usr/bin/env node

/**
 * Generate Habitable Score percentile thresholds.
 *
 * Queries NYC Open Data for all active HPD-registered buildings,
 * their violation counts, Class C counts, and complaint counts,
 * then calculates per-unit rate percentiles by building size bucket.
 *
 * Usage: node scripts/generate-score-thresholds.js
 * Requires: NYC_OPEN_DATA_APP_TOKEN in .env.local
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN || "";
const TWO_YEARS_AGO = "2024-04-10";
const BASE = "https://data.cityofnewyork.us/resource";
const LIMIT = 50000;

// ─── Helpers ────────────────────────────────────────

async function fetchPage(url, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`  [${label}] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      console.log(`  [${label}] Retrying in 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function fetchAll(url, label) {
  const results = [];
  let offset = 0;
  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const pageUrl = `${url}${sep}$limit=${LIMIT}&$offset=${offset}${APP_TOKEN ? `&$$app_token=${APP_TOKEN}` : ""}`;
    console.log(`  [${label}] Fetching offset=${offset}...`);
    const data = await fetchPage(pageUrl, label);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    console.log(`  [${label}] Got ${data.length} rows (total: ${results.length})`);
    if (data.length < LIMIT) break;
    offset += LIMIT;
  }
  return results;
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

function calcPercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: round(percentile(sorted, 10)),
    p25: round(percentile(sorted, 25)),
    p50: round(percentile(sorted, 50)),
    p75: round(percentile(sorted, 75)),
    p90: round(percentile(sorted, 90)),
    p95: round(percentile(sorted, 95)),
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function padBbl(boroid, block, lot) {
  return `${boroid}${String(block).padStart(5, "0")}${String(lot).padStart(4, "0")}`;
}

const BUCKETS = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-25", min: 11, max: 25 },
  { label: "26-50", min: 26, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-200", min: 101, max: 200 },
  { label: "201+", min: 201, max: Infinity },
];

// Closed status IDs to exclude from violation counts
// 2=VIOLATION CLOSED, 6=NOV CERTIFIED ON TIME, 9=VIOLATION DISMISSED,
// 10=NOV CERTIFIED LATE, 11=INFO NOV SENT OUT, 14=LEAD DOCS SUBMITTED ACCEPTABLE
const CLOSED_STATUS_IDS = "2,6,9,10,11,14";

// ─── Main ───────────────────────────────────────────

async function main() {
  console.log("=== Habitable Score Threshold Generator ===\n");

  // STEP 1: Get all active buildings with unit counts
  console.log("STEP 1: Fetching active buildings...");
  const buildings = await fetchAll(
    `${BASE}/kj4p-ruqc.json?$where=lifecycle='Building'&$select=buildingid,boroid,block,lot,legalclassa,legalstories`,
    "Buildings"
  );
  console.log(`  Total buildings fetched: ${buildings.length}\n`);

  // Build lookup: BBL → { units, stories, buildingid }
  const buildingMap = new Map();
  let skippedZeroUnits = 0;
  for (const b of buildings) {
    const units = parseInt(b.legalclassa) || 0;
    if (units <= 0) {
      skippedZeroUnits++;
      continue;
    }
    const bbl = padBbl(b.boroid, b.block, b.lot);
    // If multiple buildingids share a BBL, take the one with more units
    const existing = buildingMap.get(bbl);
    if (!existing || units > existing.units) {
      buildingMap.set(bbl, {
        units,
        stories: parseInt(b.legalstories) || 0,
        buildingid: b.buildingid,
      });
    }
  }
  console.log(`  Active buildings with units > 0: ${buildingMap.size} (skipped ${skippedZeroUnits} with 0 units)\n`);

  // Helper: fetch aggregated data split by borough to avoid server timeouts
  async function fetchByBorough(urlFn, label) {
    const map = new Map();
    for (const boro of [1, 2, 3, 4, 5]) {
      const boroName = ["", "Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"][boro];
      console.log(`  [${label}] Borough ${boro} (${boroName})...`);
      const rows = await fetchAll(urlFn(boro), `${label} boro=${boro}`);
      for (const r of rows) {
        if (r.bbl) map.set(r.bbl, (map.get(r.bbl) || 0) + (parseInt(r.cnt) || 0));
      }
    }
    return map;
  }

  // STEP 2: Get open violation counts per BBL (last 2 years)
  console.log("STEP 2: Fetching violation counts (last 2 years, by borough)...");
  const violationCounts = await fetchByBorough(
    (boro) => `${BASE}/wvxf-dwi5.json?$select=bbl,count(*) as cnt&$where=inspectiondate>'${TWO_YEARS_AGO}' AND currentstatusid NOT IN(${CLOSED_STATUS_IDS}) AND boroid='${boro}'&$group=bbl`,
    "Violations"
  );
  console.log(`  BBLs with violations: ${violationCounts.size}\n`);

  // STEP 3: Get Class C violation counts per BBL (last 2 years)
  console.log("STEP 3: Fetching Class C violation counts (last 2 years, by borough)...");
  const classCCounts = await fetchByBorough(
    (boro) => `${BASE}/wvxf-dwi5.json?$select=bbl,count(*) as cnt&$where=inspectiondate>'${TWO_YEARS_AGO}' AND currentstatusid NOT IN(${CLOSED_STATUS_IDS}) AND class='C' AND boroid='${boro}'&$group=bbl`,
    "Class C"
  );
  console.log(`  BBLs with Class C violations: ${classCCounts.size}\n`);

  // STEP 4: Get complaint counts per BBL (last 2 years)
  console.log("STEP 4: Fetching complaint counts (last 2 years, by borough)...");
  const complaintCounts = await fetchByBorough(
    (boro) => {
      // BBL ranges: boro 1 = 1000000000-1999999999, boro 2 = 2000000000-2999999999, etc.
      const lo = boro * 1000000000;
      const hi = (boro + 1) * 1000000000;
      return `${BASE}/ygpa-z7cr.json?$select=bbl,count(distinct complaint_id) as cnt&$where=received_date>'${TWO_YEARS_AGO}' AND bbl>=${lo} AND bbl<${hi}&$group=bbl`;
    },
    "Complaints"
  );
  console.log(`  BBLs with complaints: ${complaintCounts.size}\n`);

  // STEP 5: Calculate per-unit rates for each building
  console.log("STEP 5: Calculating per-unit rates...");
  const records = [];
  for (const [bbl, bldg] of buildingMap) {
    const vCount = violationCounts.get(bbl) || 0;
    const cCount = classCCounts.get(bbl) || 0;
    const compCount = complaintCounts.get(bbl) || 0;
    records.push({
      bbl,
      units: bldg.units,
      violations_per_unit: vCount / bldg.units,
      class_c_per_unit: cCount / bldg.units,
      complaints_per_unit: compCount / bldg.units,
    });
  }
  console.log(`  Total records: ${records.length}\n`);

  // STEP 6: Calculate percentile thresholds by bucket
  console.log("STEP 6: Calculating percentiles...\n");

  function calcBucket(recs) {
    return {
      count: recs.length,
      violations_per_unit: calcPercentiles(recs.map((r) => r.violations_per_unit)),
      class_c_per_unit: calcPercentiles(recs.map((r) => r.class_c_per_unit)),
      complaints_per_unit: calcPercentiles(recs.map((r) => r.complaints_per_unit)),
    };
  }

  const buckets = {};
  for (const b of BUCKETS) {
    const recs = records.filter((r) => r.units >= b.min && r.units <= b.max);
    buckets[b.label] = calcBucket(recs);
    console.log(`  ${b.label} units: ${recs.length} buildings`);
    console.log(`    violations/unit p50=${buckets[b.label].violations_per_unit.p50}, p90=${buckets[b.label].violations_per_unit.p90}`);
    console.log(`    class_c/unit    p50=${buckets[b.label].class_c_per_unit.p50}, p90=${buckets[b.label].class_c_per_unit.p90}`);
    console.log(`    complaints/unit p50=${buckets[b.label].complaints_per_unit.p50}, p90=${buckets[b.label].complaints_per_unit.p90}`);
  }

  const allSizes = calcBucket(records);
  console.log(`\n  All sizes: ${records.length} buildings`);
  console.log(`    violations/unit p50=${allSizes.violations_per_unit.p50}, p90=${allSizes.violations_per_unit.p90}`);

  // STEP 7: Output
  const output = {
    generated_at: new Date().toISOString().split("T")[0],
    data_window: `${TWO_YEARS_AGO} to ${new Date().toISOString().split("T")[0]}`,
    building_count: records.length,
    buckets,
    all_sizes: allSizes,
  };

  const outPath = path.join(__dirname, "score-thresholds.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nDone! Written to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
