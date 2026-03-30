"use client";

import { useState, FormEvent } from "react";

interface GeosearchResult {
  bbl: string;
  label: string;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<GeosearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      const feature = data.features?.[0];
      const bbl = feature?.properties?.addendum?.pad?.bbl;

      if (!bbl) {
        setError("No results found for that address. Try a valid NYC address.");
        return;
      }

      setResult({
        bbl,
        label: feature.properties.label,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight text-center mb-2">
          Habitable
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Search any NYC address to find its BBL number
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter a NYC address (e.g. 120 Broadway)"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-400 dark:focus:ring-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {loading && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Looking up address…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 mb-1">{result.label}</p>
            <p className="text-2xl font-semibold font-[family-name:var(--font-geist-mono)]">
              BBL: {result.bbl}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
