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
  const geoAddress = request.nextUrl.searchParams.get("address");

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
      // Use supabaseAdmin for all cached reads to bypass RLS
      const [cachedVacate, cachedComplaints, cachedLitigations, cachedBedbugs, cachedProperty, cachedBuildingDetails, cachedContacts] = await Promise.all([
        supabaseAdmin.from("vacate_orders").select("*").eq("bbl", bbl),
        supabaseAdmin.from("complaints").select("*").eq("bbl", bbl),
        supabaseAdmin.from("litigations").select("*").eq("bbl", bbl),
        supabaseAdmin.from("bedbug_reports").select("*").eq("bbl", bbl),
        supabaseAdmin.from("properties").select("address").eq("bbl", bbl).single(),
        supabaseAdmin.from("building_details").select("*").eq("bbl", bbl).maybeSingle(),
        supabaseAdmin.from("registration_contacts").select("*").eq("bbl", bbl),
      ]);

      console.log(`[/api/property] Cache hit for ${bbl}: building_details=${!!cachedBuildingDetails.data}, contacts=${(cachedContacts.data ?? []).length}, bd_error=${cachedBuildingDetails.error?.message ?? "none"}, contacts_error=${cachedContacts.error?.message ?? "none"}`);

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
        address_label: cachedAddress,
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

    // Build address from HPD data, fall back to Geosearch address
    const firstViolation = violations[0];
    const addressLabel = firstViolation
      ? `${firstViolation.housenumber} ${firstViolation.streetname}, ${(firstViolation.boro || "").charAt(0).toUpperCase() + (firstViolation.boro || "").slice(1).toLowerCase()}, NY`
      : geoAddress || null;

    console.log(`[/api/property] Fetched: ${violations.length} violations, ${vacateOrders.length} vacate orders, ${complaints.length} complaints, buildingId=${buildingId}`)

    // Log if buildingId is missing — bedbugs and litigation won't be fetched
    if (!buildingId) {
      console.warn("[/api/property] No buildingId found — skipping litigation and bedbug fetch");
    }

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
      console.log(`[/api/property] registrationId=${registrationId}, registrationRaw=${registrationRaw.length}, buildingDetailsRaw=${buildingDetailsRaw.length}`);
      if (registrationId) {
        contactsRaw = await safeFetch(
          `https://data.cityofnewyork.us/resource/feu5-w2e2.json?registrationid=${encodeURIComponent(registrationId)}&$limit=20`,
          "Registration Contacts"
        );
        console.log(`[/api/property] contactsRaw=${contactsRaw.length}, first id=${contactsRaw[0]?.registrationcontactid}`);
      }
    }

    // Map building details
    const buildingDetail = buildingDetailsRaw[0] ? {
      id: buildingId,
      building_id: buildingId,
      bbl: bbl,
      legal_stories: parseInt(buildingDetailsRaw[0].legalstories) || null,
      legal_class_a: parseInt(buildingDetailsRaw[0].legalclassa) || null,
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

    // Upsert property first (foreign key constraint)
    const { error: propertyError } = await supabaseAdmin
      .from("properties")
      .upsert(
        { bbl, building_id: buildingId, address: addressLabel, cached_at: new Date().toISOString() },
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

    console.log(`[/api/property] Fetched: ${litigations.length} litigations, ${bedbugs.length} bedbug reports`);

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
      console.log(`[/api/property] Writing building_details: building_id=${buildingDetail.building_id}, units=${buildingDetail.legal_class_a}`);
      writePromises.push(
        supabaseAdmin.from("building_details").upsert(buildingDetail, { onConflict: "id" }).then(({ error }) => {
          if (error) console.error("Supabase building_details upsert error:", JSON.stringify(error));
          else console.log("[/api/property] building_details write SUCCESS");
        })
      );
    } else {
      console.log("[/api/property] No building_details to write (buildingDetailsRaw empty)");
    }

    console.log(`[/api/property] mappedContacts.length=${mappedContacts.length}, first=${JSON.stringify(mappedContacts[0]?.id)}`);
    if (mappedContacts.length > 0) {
      console.log(`[/api/property] Writing ${mappedContacts.length} registration_contacts`);
      const { error: contactsError } = await supabaseAdmin
        .from("registration_contacts")
        .upsert(mappedContacts, { onConflict: "id" });
      if (contactsError) {
        console.error("Supabase registration_contacts upsert error:", JSON.stringify(contactsError));
      } else {
        console.log("[/api/property] registration_contacts write SUCCESS");
      }
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
      building_details: buildingDetail,
      registration_contacts: mappedContacts,
      address_label: addressLabel,
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
