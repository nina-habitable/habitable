import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "../../../lib/supabase";

async function safeFetch(url: string, label: string): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${label} API returned ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`${label} fetch error:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const bbl = request.nextUrl.searchParams.get("bbl");

  console.log("[/api/property] called with bbl:", bbl);

  if (!bbl) {
    return NextResponse.json({ error: "BBL parameter is required" }, { status: 400 });
  }

  try {
    // Check for fresh cache (less than 24 hours old)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: cached } = await supabase
      .from("violations")
      .select("*")
      .eq("bbl", bbl)
      .gte("created_at", twentyFourHoursAgo);

    if (cached && cached.length > 0) {
      // Also fetch cached data for other tables
      const [cachedVacate, cachedComplaints, cachedLitigations, cachedBedbugs] = await Promise.all([
        supabase.from("vacate_orders").select("*").eq("bbl", bbl),
        supabase.from("complaints").select("*").eq("bbl", bbl),
        supabase.from("litigations").select("*").eq("bbl", bbl),
        supabase.from("bedbug_reports").select("*").eq("bbl", bbl),
      ]);

      const cachedComplaintsList = cachedComplaints.data ?? [];
      const cachedUniqueComplaints = new Set(cachedComplaintsList.map((c: Record<string, string>) => c.complaint_id));

      return NextResponse.json({
        violations: cached,
        vacate_orders: cachedVacate.data ?? [],
        complaints: cachedComplaintsList,
        complaint_count: cachedUniqueComplaints.size,
        litigations: cachedLitigations.data ?? [],
        bedbug_reports: cachedBedbugs.data ?? [],
        cached_at: cached[0].created_at,
        from_cache: true,
      });
    }

    // Excluded statuses (non-open / resolved / dismissed):
    //   VIOLATION CLOSED, VIOLATION DISMISSED, NOV CERTIFIED LATE,
    //   NOV CERTIFIED ON TIME, INFO NOV SENT OUT, LEAD DOCS SUBMITTED, ACCEPTABLE
    const whereClause = [
      "currentstatus!='VIOLATION CLOSED'",
      "currentstatus!='VIOLATION DISMISSED'",
      "currentstatus!='NOV CERTIFIED LATE'",
      "currentstatus!='NOV CERTIFIED ON TIME'",
      "currentstatus!='INFO NOV SENT OUT'",
      "currentstatus!='LEAD DOCS SUBMITTED, ACCEPTABLE'",
    ].join(" AND ");

    const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN || "";
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch violations, vacate orders, and complaints in parallel
    const [violations, vacateOrders, complaints] = await Promise.all([
      safeFetch(
        `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?bbl=${encodeURIComponent(bbl)}&$limit=2000&$where=${encodeURIComponent(whereClause)}`,
        "HPD Violations"
      ),
      safeFetch(
        `https://data.cityofnewyork.us/resource/tb8q-a3ar.json?bbl=${encodeURIComponent(bbl)}&$limit=10`,
        "Vacate Orders"
      ),
      safeFetch(
        `https://data.cityofnewyork.us/resource/ygpa-z7cr.json?bbl=${encodeURIComponent(bbl)}&$limit=500&$$app_token=${appToken}&$where=received_date>'${twoYearsAgo}'`,
        "Complaints"
      ),
    ]);

    const uniqueComplaintIds = new Set(complaints.map((c: Record<string, string>) => c.complaint_id));
    const complaintCount = uniqueComplaintIds.size;

    // Extract building_id from any response that has it
    const buildingId =
      violations[0]?.buildingid ||
      vacateOrders[0]?.building_id ||
      complaints[0]?.building_id ||
      null;

    console.log(`[/api/property] Fetched: ${violations.length} violations, ${vacateOrders.length} vacate orders, ${complaints.length} complaints, buildingId=${buildingId}`);

    // Fetch litigation and bedbug reports if we have a building_id
    let litigations: Record<string, string>[] = [];
    let bedbugs: Record<string, string>[] = [];
    if (buildingId) {
      [litigations, bedbugs] = await Promise.all([
        safeFetch(
          `https://data.cityofnewyork.us/resource/59kj-x8nc.json?buildingid=${encodeURIComponent(buildingId)}&$limit=500`,
          "Litigation"
        ),
        safeFetch(
          `https://data.cityofnewyork.us/resource/wz6d-d3jb.json?building_id=${encodeURIComponent(buildingId)}&$limit=100`,
          "Bedbug Reports"
        ),
      ]);
    }

    // Upsert property first (foreign key constraint)
    const { error: propertyError } = await supabaseAdmin
      .from("properties")
      .upsert(
        { bbl, building_id: buildingId, cached_at: new Date().toISOString() },
        { onConflict: "bbl" }
      );

    if (propertyError) {
      console.error("Supabase properties upsert error:", propertyError);
    }

    // Write all data to Supabase in parallel
    const writePromises: PromiseLike<unknown>[] = [];

    if (violations.length > 0) {
      const rows = violations.map((v) => ({
        id: v.violationid,
        bbl: v.bbl,
        class: v.class,
        status: v.currentstatus || null,
        novdescription: v.novdescription || null,
        inspectiondate: v.inspectiondate || null,
        currentstatusdate: v.currentstatusdate || null,
        raw: v,
      }));
      writePromises.push(
        supabaseAdmin.from("violations").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase violations upsert error:", error);
        })
      );
    }

    if (vacateOrders.length > 0) {
      const rows = vacateOrders.map((v) => ({
        id: v.vacate_order_number,
        bbl: v.bbl,
        vacate_type: v.vacate_type || null,
        reason: v.primary_vacate_reason || null,
        effective_date: v.vacate_effective_date || null,
        units_vacated: v.number_of_vacated_units || null,
      }));
      writePromises.push(
        supabaseAdmin.from("vacate_orders").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase vacate_orders upsert error:", error);
        })
      );
    }

    if (complaints.length > 0) {
      console.log(`[/api/property] Writing ${complaints.length} complaints for bbl ${bbl}`);
      const rows = complaints.map((v) => ({
        id: v.problem_id,
        bbl: bbl,
        complaint_id: v.complaint_id || null,
        complaint_status: v.complaint_status || null,
        major_category: v.major_category || null,
        type: v.type || null,
        received_date: v.received_date || null,
      }));
      writePromises.push(
        supabaseAdmin.from("complaints").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase complaints upsert error:", error);
        })
      );
    }

    if (litigations.length > 0) {
      const rows = litigations.map((v) => ({
        id: v.litigationid,
        bbl: bbl,
        building_id: v.buildingid || null,
        casetype: v.casetype || null,
        casestatus: v.casestatus || null,
        caseopendate: v.caseopendate || null,
        respondent: v.respondent || null,
      }));
      writePromises.push(
        supabaseAdmin.from("litigations").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase litigations upsert error:", error);
        })
      );
    }

    if (bedbugs.length > 0) {
      const rows = bedbugs.map((v, i) => ({
        id: `${buildingId}-${v.filing_date || i}`,
        bbl: bbl,
        building_id: v.building_id || buildingId,
        filing_date: v.filing_date || null,
        infested_unit_count: parseInt(v.infested_dwelling_unit_count) || 0,
        eradicated_unit_count: parseInt(v.eradicated_unit_count) || 0,
      }));
      writePromises.push(
        supabaseAdmin.from("bedbug_reports").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase bedbug_reports upsert error:", error);
        })
      );
    }

    await Promise.all(writePromises);

    // Return freshly fetched data mapped to our schema
    const mappedViolations = violations.map((v) => ({
      id: v.violationid,
      bbl: v.bbl,
      class: v.class,
      status: v.currentstatus || null,
      novdescription: v.novdescription || null,
      inspectiondate: v.inspectiondate || null,
      currentstatusdate: v.currentstatusdate || null,
    }));

    const mappedVacate = vacateOrders.map((v) => ({
      id: v.vacate_order_number,
      bbl: v.bbl,
      vacate_type: v.vacate_type || null,
      reason: v.primary_vacate_reason || null,
      effective_date: v.vacate_effective_date || null,
      units_vacated: v.number_of_vacated_units || null,
    }));

    const mappedComplaints = complaints.map((v) => ({
      id: v.problem_id,
      bbl: bbl,
      complaint_id: v.complaint_id || null,
      complaint_status: v.complaint_status || null,
      major_category: v.major_category || null,
      type: v.type || null,
      received_date: v.received_date || null,
    }));

    const mappedLitigations = litigations.map((v) => ({
      id: v.litigationid,
      bbl: bbl,
      building_id: v.buildingid || null,
      casetype: v.casetype || null,
      casestatus: v.casestatus || null,
      caseopendate: v.caseopendate || null,
      respondent: v.respondent || null,
    }));

    const mappedBedbugs = bedbugs.map((v, i) => ({
      id: `${buildingId}-${v.filing_date || i}`,
      bbl: bbl,
      building_id: v.building_id || buildingId,
      filing_date: v.filing_date || null,
      infested_unit_count: parseInt(v.infested_dwelling_unit_count) || 0,
      eradicated_unit_count: parseInt(v.eradicated_unit_count) || 0,
    }));

    return NextResponse.json({
      violations: mappedViolations,
      vacate_orders: mappedVacate,
      complaints: mappedComplaints,
      complaint_count: complaintCount,
      litigations: mappedLitigations,
      bedbug_reports: mappedBedbugs,
      cached_at: new Date().toISOString(),
      from_cache: false,
    });
  } catch (error) {
    console.error("Property API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property data" },
      { status: 500 }
    );
  }
}
