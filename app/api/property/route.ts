import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "../../../lib/supabase";

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
      return NextResponse.json({
        violations: cached,
        cached_at: cached[0].created_at,
        from_cache: true,
      });
    }

    // Fetch from NYC HPD Open Data API
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

    const hpdRes = await fetch(
      `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?bbl=${encodeURIComponent(bbl)}&$limit=2000&$where=${encodeURIComponent(whereClause)}`
    );

    if (!hpdRes.ok) {
      throw new Error(`HPD API returned ${hpdRes.status}`);
    }

    const violations = await hpdRes.json();

    // Upsert property first (violations has a foreign key on bbl)
    const { error: propertyError } = await supabaseAdmin
      .from("properties")
      .upsert({ bbl, cached_at: new Date().toISOString() }, { onConflict: "bbl" });

    if (propertyError) {
      console.error("Supabase properties upsert error:", propertyError);
    }

    if (violations.length > 0) {
      // Upsert violations by violationid
      const rows = violations.map((v: Record<string, string>) => ({
        id: v.violationid,
        bbl: v.bbl,
        class: v.class,
        status: v.currentstatus || null,
        novdescription: v.novdescription || null,
        inspectiondate: v.inspectiondate || null,
        currentstatusdate: v.currentstatusdate || null,
        raw: v,
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("violations")
        .upsert(rows, { onConflict: "id" });

      if (upsertError) {
        console.error("Supabase violations upsert error:", upsertError);
      }
    }

    // Return freshly fetched data mapped to our schema
    const mapped = violations.map((v: Record<string, string>) => ({
      id: v.violationid,
      bbl: v.bbl,
      class: v.class,
      status: v.currentstatus || null,
      novdescription: v.novdescription || null,
      inspectiondate: v.inspectiondate || null,
      currentstatusdate: v.currentstatusdate || null,
    }));

    return NextResponse.json({
      violations: mapped,
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
