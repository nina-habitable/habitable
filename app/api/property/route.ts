import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(request: NextRequest) {
  const bbl = request.nextUrl.searchParams.get("bbl");

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
    const hpdRes = await fetch(
      `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?bbl=${encodeURIComponent(bbl)}&$limit=2000&$where=currentstatus!=%27VIOLATION%20CLOSED%27`
    );

    if (!hpdRes.ok) {
      throw new Error(`HPD API returned ${hpdRes.status}`);
    }

    const violations = await hpdRes.json();

    if (violations.length > 0) {
      // Upsert violations by violationid
      const rows = violations.map((v: Record<string, string>) => ({
        id: v.violationid,
        bbl: v.bbl,
        class: v.class,
        inspection_date: v.inspectiondate || null,
        description: v.novdescription || null,
        status: v.currentstatus || null,
        status_date: v.currentstatusdate || null,
        raw: v,
      }));

      await supabase.from("violations").upsert(rows, { onConflict: "id" });
    }

    // Upsert property
    await supabase.from("properties").upsert(
      { bbl, last_fetched: new Date().toISOString() },
      { onConflict: "bbl" }
    );

    // Return freshly fetched data mapped to our schema
    const mapped = violations.map((v: Record<string, string>) => ({
      id: v.violationid,
      bbl: v.bbl,
      class: v.class,
      inspection_date: v.inspectiondate || null,
      description: v.novdescription || null,
      status: v.currentstatus || null,
      status_date: v.currentstatusdate || null,
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
