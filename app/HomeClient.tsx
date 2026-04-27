"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AddressAutocomplete, { type Suggestion } from "./components/AddressAutocomplete";

export default function HomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function gotoBbl(bbl: string, query: string, label: string, bin: string, coords: string, neighbourhood: string, searched?: string) {
    const params = new URLSearchParams({ q: query, address: label, bin, coords, hood: neighbourhood });
    if (searched) params.set("searched", searched);
    router.push(`/property/${bbl}?${params.toString()}`);
  }

  async function handleSubmit({ address }: { address: string }) {
    if (!address) return;
    if (!/\d/.test(address)) {
      setError("Please include a street number (e.g. 553 Howard Ave)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = address;
      const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;
      if (!foundBbl) {
        setError("No results found for that address. Try a valid NYC address.");
        setLoading(false);
        return;
      }
      const label = feature.properties.label || "";
      const bin = feature.properties.addendum?.pad?.bin || "";
      const neighbourhood = feature.properties.neighbourhood || "";
      const [lng, lat] = feature.geometry?.coordinates || [];
      const coords = lat && lng ? `${lat},${lng}` : "";
      gotoBbl(foundBbl, address, label, bin, coords, neighbourhood, address);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function handleSelect(s: Suggestion) {
    gotoBbl(s.bbl, s.name, s.label, s.bin, s.coords, s.neighbourhood, s.name);
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-xl px-5">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] text-center mb-2">
          Habitable
        </h1>
        <p className="text-sm text-[var(--muted)] text-center mb-8">
          Look up any NYC building before you sign a lease
        </p>
        <AddressAutocomplete onSubmit={handleSubmit} onSelect={handleSelect} variant="hero" />
        {loading && <p className="text-center text-xs text-[var(--muted-dim)] mt-3">Loading...</p>}
        {error && (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="text-center mt-4">
          <Link
            href="/compare"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Compare multiple buildings
          </Link>
        </div>
      </div>
    </div>
  );
}
