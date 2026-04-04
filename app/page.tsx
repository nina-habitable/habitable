"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [borough, setBorough] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;

    if (!/\d/.test(trimmed)) {
      setError("Please include a street number (e.g. 553 Howard Ave, Brooklyn)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = borough ? `${trimmed}, ${borough}, NY` : trimmed;
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}`
      );
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
      router.push(`/property/${foundBbl}?q=${encodeURIComponent(trimmed)}&address=${encodeURIComponent(label)}&bin=${bin}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter address (e.g., 553 Howard Ave, Brooklyn)"
            className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-dim)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
          />
          <select
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
          >
            <option value="">Any borough</option>
            <option value="Manhattan">Manhattan</option>
            <option value="Brooklyn">Brooklyn</option>
            <option value="Queens">Queens</option>
            <option value="Bronx">Bronx</option>
            <option value="Staten Island">Staten Island</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--foreground)] px-5 py-3 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "..." : "Search"}
          </button>
        </form>
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
