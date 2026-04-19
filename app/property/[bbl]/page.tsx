import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import PropertyContent from "./PropertyClient";

const supabaseUrl = "https://enjqwfxtwokyeplwpzoi.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || "";

export async function generateMetadata({ params }: { params: { bbl: string } }): Promise<Metadata> {
  const bbl = params.bbl;
  const baseUrl = "https://habitable-xi.vercel.app";

  try {
    if (!supabaseKey) throw new Error("No key");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const CLOSED = new Set([
      "VIOLATION CLOSED", "VIOLATION DISMISSED", "NOV CERTIFIED LATE",
      "NOV CERTIFIED ON TIME", "INFO NOV SENT OUT", "LEAD DOCS SUBMITTED, ACCEPTABLE",
      "CERTIFICATION POSTPONEMENT GRANTED",
    ]);

    const [propResult, complaintResult] = await Promise.all([
      supabase.from("properties").select("address,nta").eq("bbl", bbl).single(),
      supabase.from("complaints").select("complaint_id").eq("bbl", bbl).range(0, 4999),
    ]);

    const address = propResult.data?.address;
    if (!address) throw new Error("Not cached");

    // Paginate violations to bypass Supabase 1000-row limit
    const allStatuses: string[] = [];
    let offset = 0;
    while (true) {
      const { data: batch } = await supabase.from("violations").select("status").eq("bbl", bbl).range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allStatuses.push(...batch.map((v: { status: string }) => v.status));
      if (batch.length < 1000) break;
      offset += 1000;
    }

    const violationCount = allStatuses.filter((s) => !CLOSED.has(s)).length;
    const complaintCount = new Set((complaintResult.data ?? []).map((c: { complaint_id: string }) => c.complaint_id)).size;

    const title = `${address} — Building Report | Habitable`;
    const description = `${violationCount} open violations · ${complaintCount} complaints · Check this building before signing a lease.`;

    return {
      title,
      description,
      openGraph: { title, description, type: "website", url: `${baseUrl}/property/${bbl}` },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {
      title: "Building Report | Habitable",
      description: "Look up any NYC building before you sign a lease. Violations, complaints, ownership, and safety data in plain English.",
      openGraph: { title: "Building Report | Habitable", description: "Look up any NYC building before you sign a lease.", type: "website", url: `${baseUrl}/property/${bbl}` },
      twitter: { card: "summary", title: "Building Report | Habitable" },
    };
  }
}

export default function PropertyPage({ params }: { params: { bbl: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <PropertyContent bbl={params.bbl} />
    </Suspense>
  );
}
