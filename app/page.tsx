"use client";

import { useState, FormEvent } from "react";

interface Violation {
  id: string;
  bbl: string;
  class: string;
  inspection_date: string | null;
  description: string | null;
  status: string | null;
  status_date: string | null;
}

interface PropertyResponse {
  violations: Violation[];
  cached_at: string;
  from_cache: boolean;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [bbl, setBbl] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [error, setError] = useState("");

  async function fetchViolations(bblValue: string) {
    setLoadingViolations(true);
    try {
      const res = await fetch(`/api/property?bbl=${encodeURIComponent(bblValue)}`);
      if (!res.ok) throw new Error("Failed to fetch violations");
      const data: PropertyResponse = await res.json();
      setPropertyData(data);
    } catch {
      setError("Failed to load violation data.");
    } finally {
      setLoadingViolations(false);
    }
  }

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
    setBbl("");
    setAddressLabel("");
    setPropertyData(null);

    try {
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      const feature = data.features?.[0];
      const foundBbl = feature?.properties?.addendum?.pad?.bbl;

      if (!foundBbl) {
        setError("No results found for that address. Try a valid NYC address.");
        return;
      }

      setBbl(foundBbl);
      setAddressLabel(feature.properties.label);
      setLoading(false);

      await fetchViolations(foundBbl);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const classCount = (cls: string) =>
    propertyData?.violations.filter((v) => v.class === cls).length ?? 0;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-24 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-center mb-2">
          Habitable
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Search any NYC address to find its BBL number and HPD violations
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter a NYC address (e.g. 553 Howard Ave, Brooklyn)"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-400 dark:focus:ring-gray-400"
          />
          <button
            type="submit"
            disabled={loading || loadingViolations}
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

        {bbl && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 mb-1">{addressLabel}</p>
            <p className="text-2xl font-semibold font-[family-name:var(--font-geist-mono)]">
              BBL: {bbl}
            </p>
          </div>
        )}

        {loadingViolations && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Loading violations…
          </div>
        )}

        {propertyData && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-2xl font-bold">{propertyData.violations.length}</p>
                <p className="text-xs text-gray-500 mt-1">All Open</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-2xl font-bold">{classCount("A")}</p>
                <p className="text-xs text-gray-500 mt-1">Class A</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-2xl font-bold">{classCount("B")}</p>
                <p className="text-xs text-gray-500 mt-1">Class B</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-2xl font-bold">{classCount("C")}</p>
                <p className="text-xs text-gray-500 mt-1">Class C</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-2xl font-bold">{classCount("I")}</p>
                <p className="text-xs text-gray-500 mt-1">Class I</p>
              </div>
            </div>

            <div className="text-xs text-gray-400 text-right">
              {propertyData.from_cache ? "From cache" : "Fresh data"} ·{" "}
              {formatDate(propertyData.cached_at)}
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium">Class</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {propertyData.violations.slice(0, 10).map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2 font-medium">{v.class}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {v.description ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs">{v.status ?? "—"}</td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap">
                        {formatDate(v.inspection_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {propertyData.violations.length > 10 && (
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900">
                  Showing 10 of {propertyData.violations.length} violations
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
