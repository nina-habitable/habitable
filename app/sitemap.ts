import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://habitable-xi.vercel.app";
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), priority: 0.6 },
  ];

  try {
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseKey) return entries;

    const supabase = createClient(
      "https://enjqwfxtwokyeplwpzoi.supabase.co",
      supabaseKey
    );

    const { data } = await supabase
      .from("properties")
      .select("bbl,cached_at")
      .order("cached_at", { ascending: false })
      .limit(5000);

    if (data) {
      for (const row of data) {
        entries.push({
          url: `${baseUrl}/property/${row.bbl}`,
          lastModified: row.cached_at ? new Date(row.cached_at) : new Date(),
          priority: 0.8,
        });
      }
    }
  } catch {
    // Return static entries on error
  }

  return entries;
}
