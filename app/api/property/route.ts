import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

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
  const geoAddress = request.nextUrl.searchParams.get("address");
  const geoBin = request.nextUrl.searchParams.get("bin");
  const geoHood = request.nextUrl.searchParams.get("hood");


  // Validate BBL parameter
  if (!bbl) {
    return NextResponse.json({ error: "BBL parameter is required" }, { status: 400 });
  }

  try {
    // Check for fresh cache (less than 24 hours old)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch violations in batches to bypass Supabase 1000-row default limit
    const cached: Record<string, unknown>[] = [];
    {
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabaseAdmin
          .from("violations")
          .select("*")
          .eq("bbl", bbl)
          .gte("created_at", twentyFourHoursAgo)
          .range(offset, offset + batchSize - 1);
        if (!batch || batch.length === 0) break;
        cached.push(...batch);
        if (batch.length < batchSize) break;
        offset += batchSize;
      }
    }

    if (cached && cached.length > 0) {
      // Use supabaseAdmin for all cached reads to bypass RLS
      const [cachedVacate, cachedComplaints, cachedLitigations, cachedBedbugs, cachedProperty, cachedBuildingDetails, cachedContacts, cachedAep, cached311, cachedLead, cachedWorkOrders] = await Promise.all([
        supabaseAdmin.from("vacate_orders").select("*").eq("bbl", bbl),
        supabaseAdmin.from("complaints").select("*").eq("bbl", bbl).range(0, 4999),
        supabaseAdmin.from("litigations").select("*").eq("bbl", bbl).limit(1000),
        supabaseAdmin.from("bedbug_reports").select("*").eq("bbl", bbl),
        supabaseAdmin.from("properties").select("address,nta").eq("bbl", bbl).single(),
        supabaseAdmin.from("building_details").select("*").eq("bbl", bbl).maybeSingle(),
        supabaseAdmin.from("registration_contacts").select("*").eq("bbl", bbl),
        supabaseAdmin.from("aep_status").select("*").eq("bbl", bbl),
        supabaseAdmin.from("service_requests_311").select("*").eq("bbl", bbl),
        supabaseAdmin.from("lead_violations").select("*").eq("bbl", bbl),
        supabaseAdmin.from("work_orders").select("*").eq("bbl", bbl),
      ]);


      const cachedComplaintsList = cachedComplaints.data ?? [];
      const cachedUniqueComplaints = new Set(cachedComplaintsList.map((c: Record<string, string>) => c.complaint_id));

      // Build address from cached violation data if not in properties table
      let cachedAddress = cachedProperty.data?.address ?? null;
      if (!cachedAddress && cached[0]?.raw) {
        const raw = typeof cached[0].raw === "string" ? JSON.parse(cached[0].raw) : cached[0].raw;
        if (raw.housenumber && raw.streetname) {
          const boro = (raw.boro || "").charAt(0).toUpperCase() + (raw.boro || "").slice(1).toLowerCase();
          cachedAddress = `${raw.housenumber} ${raw.streetname}, ${boro}, NY`;
        }
      }

      return NextResponse.json({
        violations: cached,
        vacate_orders: cachedVacate.data ?? [],
        complaints: cachedComplaintsList,
        complaint_count: cachedUniqueComplaints.size,
        litigations: cachedLitigations.data ?? [],
        bedbug_reports: cachedBedbugs.data ?? [],
        building_details: cachedBuildingDetails.data ?? null,
        registration_contacts: cachedContacts.data ?? [],
        aep_status: cachedAep.data ?? [],
        service_requests_311: cached311.data ?? [],
        lead_violations: cachedLead.data ?? [],
        work_orders: cachedWorkOrders.data ?? [],
        address_label: cachedAddress,
        nta: cachedProperty.data?.nta ?? null,
        cached_at: cached[0].created_at,
        from_cache: true,
      });
    }

    const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN || "";
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch ALL violations (no status filter — frontend filters open vs pending)
    const [violations, vacateOrders, complaints, aepRaw, raw311, leadRaw, omoRaw] = await Promise.all([
      safeFetch(
        `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?bbl=${encodeURIComponent(bbl)}&$limit=5000`,
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
      safeFetch(
        `https://data.cityofnewyork.us/resource/hcir-3275.json?bbl=${encodeURIComponent(bbl)}&$limit=50`,
        "AEP Status"
      ),
      safeFetch(
        `https://data.cityofnewyork.us/resource/erm2-nwe9.json?$where=bbl='${bbl}' AND agency!='HPD'&$limit=200`,
        "311 Service Requests"
      ),
      safeFetch(
        `https://data.cityofnewyork.us/resource/v574-pyre.json?boroid=${bbl[0]}&block=${bbl.slice(1, 6)}&lot=${bbl.slice(6)}&$limit=500`,
        "Lead Paint Violations"
      ),
      safeFetch(
        `https://data.cityofnewyork.us/resource/mdbu-nrqn.json?bbl=${encodeURIComponent(bbl)}&$limit=200`,
        "Emergency Work Orders"
      ),
    ]);

    const uniqueComplaintIds = new Set(complaints.map((c: Record<string, string>) => c.complaint_id));
    const complaintCount = uniqueComplaintIds.size;

    // Extract building_id from any response that has it
    let buildingId =
      violations[0]?.buildingid ||
      vacateOrders[0]?.building_id ||
      complaints[0]?.building_id ||
      null;

    // Fallback: look up buildingid via BIN from HPD Buildings dataset
    const bin = violations[0]?.bin || geoBin;
    if (!buildingId && bin) {
      const binLookup = await safeFetch(
        `https://data.cityofnewyork.us/resource/kj4p-ruqc.json?bin=${encodeURIComponent(bin)}&$limit=1`,
        "HPD Buildings (BIN lookup)"
      );
      if (binLookup[0]?.buildingid) {
        buildingId = binLookup[0].buildingid;
      }
    }

    // Build address from HPD data, fall back to Geosearch address
    const firstViolation = violations[0];
    const addressLabel = firstViolation
      ? `${firstViolation.housenumber} ${firstViolation.streetname}, ${(firstViolation.boro || "").charAt(0).toUpperCase() + (firstViolation.boro || "").slice(1).toLowerCase()}, NY`
      : geoAddress || null;
    // Prefer Geosearch neighbourhood (clean single name) over violation NTA (combined)
    const nta = geoHood || firstViolation?.nta || null;


    // Fetch litigation, bedbug, building details, and registration if we have a building_id
    let litigations: Record<string, string>[] = [];
    let bedbugs: Record<string, string>[] = [];
    let buildingDetailsRaw: Record<string, string>[] = [];
    let registrationRaw: Record<string, string>[] = [];
    let contactsRaw: Record<string, string>[] = [];

    if (buildingId) {
      [litigations, bedbugs, buildingDetailsRaw, registrationRaw] = await Promise.all([
        safeFetch(
          `https://data.cityofnewyork.us/resource/59kj-x8nc.json?buildingid=${encodeURIComponent(buildingId)}&$limit=500`,
          "Litigation"
        ),
        safeFetch(
          `https://data.cityofnewyork.us/resource/wz6d-d3jb.json?building_id=${encodeURIComponent(buildingId)}&$limit=100`,
          "Bedbug Reports"
        ),
        safeFetch(
          `https://data.cityofnewyork.us/resource/kj4p-ruqc.json?buildingid=${encodeURIComponent(buildingId)}&$limit=1`,
          "Building Details"
        ),
        safeFetch(
          `https://data.cityofnewyork.us/resource/tesw-yqqr.json?buildingid=${encodeURIComponent(buildingId)}&$limit=1`,
          "Registration"
        ),
      ]);

      // Chain: fetch contacts using registrationid from registration response
      const registrationId = registrationRaw[0]?.registrationid || buildingDetailsRaw[0]?.registrationid;
      if (registrationId) {
        contactsRaw = await safeFetch(
          `https://data.cityofnewyork.us/resource/feu5-w2e2.json?registrationid=${encodeURIComponent(registrationId)}&$limit=20`,
          "Registration Contacts"
        );
      }
    }

    // Map building details
    const buildingDetail = buildingDetailsRaw[0] ? {
      id: buildingId,
      building_id: buildingId,
      bbl: bbl,
      legal_stories: parseInt(buildingDetailsRaw[0].legalstories) || null,
      legal_class_a: parseInt(buildingDetailsRaw[0].legalclassa) || null,
      legal_class_b: parseInt(buildingDetailsRaw[0].legalclassb) || null,
      dob_building_class: buildingDetailsRaw[0].dobbuildingclass || null,
      management_program: buildingDetailsRaw[0].managementprogram || null,
      registration_id: buildingDetailsRaw[0].registrationid || null,
    } : null;

    // Map contacts
    const mappedContacts = contactsRaw.map((c) => {
      const bizParts = [c.businesshousenumber, c.businessstreetname, c.businesscity, c.businessstate, c.businesszip].filter(Boolean);
      return {
        id: c.registrationcontactid,
        registration_id: c.registrationid,
        bbl: bbl,
        type: c.type || "Unknown",
        corporation_name: c.corporationname || null,
        first_name: c.firstname || null,
        last_name: c.lastname || null,
        contact_description: c.contactdescription || null,
        business_address: bizParts.length > 0 ? bizParts.join(" ") : null,
      };
    });

    // Filter and map 311 service requests
    const relevantAgencies = new Set(["DOB", "FDNY", "DEP", "DOHMH"]);
    const excludePatterns = /noise|parking|unleashed dog|blocked driveway/i;
    const mapped311 = raw311
      .filter((r) => relevantAgencies.has(r.agency) && !excludePatterns.test(r.complaint_type || ""))
      .map((r) => ({
        id: r.unique_key,
        bbl: bbl,
        unique_key: r.unique_key,
        agency: r.agency || null,
        agency_name: r.agency_name || null,
        complaint_type: r.complaint_type || null,
        descriptor: r.descriptor || null,
        status: r.status || null,
        created_date: r.created_date || null,
        closed_date: r.closed_date || null,
        resolution_description: r.resolution_description || null,
      }));

    // Map AEP entries
    const mappedAep = aepRaw.map((a) => ({
      id: `${a.building_id || bbl}-${a.aep_start_date || "unknown"}`,
      bbl: bbl,
      building_id: a.building_id || null,
      aep_start_date: a.aep_start_date || null,
      discharge_date: a.discharge_date || null,
      current_status: a.current_status || null,
      aep_round: a.aep_round || null,
      violations_at_start: parseInt(a.of_b_c_violations_at_start) || null,
    }));

    // Map lead paint violations
    const mappedLead = leadRaw.map((v) => ({
      id: v.violationid,
      bbl: bbl,
      violation_id: v.violationid,
      class: v.class || "C",
      status: v.currentstatus || null,
      novdescription: v.novdescription || null,
      inspectiondate: v.inspectiondate || null,
      currentstatusdate: v.currentstatusdate || null,
      apartment: v.apartment || null,
    }));

    // Map emergency work orders
    const mappedWorkOrders = omoRaw.map((o) => ({
      id: o.omoid,
      bbl: bbl,
      omo_id: o.omoid,
      omo_number: o.omonumber || null,
      building_id: o.buildingid || null,
      work_type: o.worktypegeneral || null,
      status_reason: o.omostatusreason || null,
      award_amount: parseFloat(o.omoawardamount) || null,
      created_date: o.omocreatedate || null,
      description: o.omodescription || null,
    }));

    // Upsert property first (foreign key constraint)
    const { error: propertyError } = await supabaseAdmin
      .from("properties")
      .upsert(
        { bbl, building_id: buildingId, address: addressLabel, nta: nta, cached_at: new Date().toISOString() },
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
        rescind_date: v.actual_rescind_date || null,
      }));
      writePromises.push(
        supabaseAdmin.from("vacate_orders").upsert(rows, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase vacate_orders upsert error:", error);
        })
      );
    }

    if (complaints.length > 0) {
      const rows = complaints.map((v) => ({
        id: v.problem_id,
        bbl: bbl,
        complaint_id: v.complaint_id || null,
        complaint_status: v.complaint_status || null,
        major_category: v.major_category || null,
        minor_category: v.minor_category || null,
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

    if (buildingDetail) {
      writePromises.push(
        supabaseAdmin.from("building_details").upsert(buildingDetail, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase building_details upsert error:", JSON.stringify(error));
        })
      );
    } else {
    }

    if (mappedContacts.length > 0) {
      const { error: contactsError } = await supabaseAdmin
        .from("registration_contacts")
        .upsert(mappedContacts, { onConflict: "id" });
      if (contactsError) {
        console.error("Supabase registration_contacts upsert error:", JSON.stringify(contactsError));
      } else {
      }
    }

    if (mappedAep.length > 0) {
      const { error: aepError } = await supabaseAdmin
        .from("aep_status")
        .upsert(mappedAep, { onConflict: "id" });
      if (aepError) console.error("Supabase aep_status upsert error:", JSON.stringify(aepError));
    }

    if (mapped311.length > 0) {
      const { error: err311 } = await supabaseAdmin
        .from("service_requests_311")
        .upsert(mapped311, { onConflict: "id" });
      if (err311) console.error("Supabase service_requests_311 upsert error:", JSON.stringify(err311));
    }

    if (mappedLead.length > 0) {
      const { error: leadErr } = await supabaseAdmin.from("lead_violations").upsert(mappedLead, { onConflict: "id" });
      if (leadErr) console.error("Supabase lead_violations upsert error:", JSON.stringify(leadErr));
    }

    if (mappedWorkOrders.length > 0) {
      const { error: omoErr } = await supabaseAdmin.from("work_orders").upsert(mappedWorkOrders, { onConflict: "id" });
      if (omoErr) console.error("Supabase work_orders upsert error:", JSON.stringify(omoErr));
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
      rescind_date: v.actual_rescind_date || null,
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
      building_details: buildingDetail,
      registration_contacts: mappedContacts,
      aep_status: mappedAep,
      service_requests_311: mapped311,
      lead_violations: mappedLead,
      work_orders: mappedWorkOrders,
      address_label: addressLabel,
      nta: nta,
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
