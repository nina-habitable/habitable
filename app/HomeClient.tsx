"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type Suggestion } from "./components/AddressAutocomplete";
import Footer from "./components/Footer";

const VALUE_CARDS = [
  {
    iconBg: "oklch(0.96 0.03 155)",
    iconDot: "var(--signal-green)",
    title: "Building assessment",
    description: "A plain-English summary of violations, complaints, and red flags",
  },
  {
    iconBg: "var(--sev-b-soft)",
    iconDot: "var(--sev-b)",
    title: "12 sources, one report",
    description: "Violations, lawsuits, bed bugs, lead paint, vacate orders, and more",
  },
  {
    iconBg: "var(--sev-a-soft)",
    iconDot: "var(--sev-a)",
    title: "Ownership trail",
    description: "Who owns the building, who manages it, and what else they own",
  },
];

function Divider() {
  return <div className="w-12 h-px bg-[var(--hab-line)] mx-auto" />;
}

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
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-ui)]">
      <main className="flex-1 w-full max-w-2xl mx-auto px-5">

        {/* SECTION 1: HERO */}
        <section className="pt-20 pb-12 text-center">
          <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.08em] text-[var(--hab-muted)] mb-6">
            Habitable
          </p>
          <h1 className="text-2xl font-[family-name:var(--font-serif)] font-normal text-[var(--hab-ink)] leading-snug mb-4">
            Every NYC building has a public record.<br />
            Here&apos;s what yours says.
          </h1>
          <p className="text-base text-[var(--hab-ink-2)] leading-relaxed max-w-xl mx-auto mb-2">
            We turn 12 city data sources into a plain-English building assessment you can read in 90 seconds.
          </p>
          <p className="text-xs text-[var(--hab-muted)] mb-8">
            Exposed through 318,000+ NYC building records from HPD, ACRIS, and 311.
          </p>
          <div className="max-w-xl mx-auto text-left">
            <AddressAutocomplete onSubmit={handleSubmit} onSelect={handleSelect} variant="hero" />
            {loading && <p className="text-center text-xs text-[var(--hab-ink-2)] mt-3">Loading...</p>}
            {error && (
              <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--banner-red-border)", background: "var(--banner-red-bg)", color: "var(--banner-red-ink)" }}>
                {error}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: TRUST STRIP */}
        <section className="py-10">
          <Divider />
          <p className="mt-8 text-center text-sm text-[var(--hab-muted)] leading-relaxed max-w-xl mx-auto">
            All data sourced directly from{" "}
            <span className="font-medium text-[var(--hab-ink-2)]">NYC HPD Open Data</span>,{" "}
            <span className="font-medium text-[var(--hab-ink-2)]">311 Service Requests</span>, and{" "}
            <span className="font-medium text-[var(--hab-ink-2)]">ACRIS Property Records</span>
          </p>
        </section>

        {/* SECTION 3: WHAT YOU GET */}
        <section className="py-10">
          <Divider />
          <p className="mt-8 mb-6 text-center text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] text-[var(--hab-muted)]">
            What You Get
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {VALUE_CARDS.map((card) => (
              <div key={card.title} className="rounded-xl border border-[var(--hab-line)] bg-[var(--hab-paper)] p-5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-3" style={{ background: card.iconBg }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: card.iconDot }} />
                </div>
                <h3 className="text-sm font-medium text-[var(--hab-ink)] mb-1">{card.title}</h3>
                <p className="text-sm text-[var(--hab-muted)] leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: CLOSING */}
        <section className="py-10">
          <Divider />
          <p className="mt-8 text-center italic font-[family-name:var(--font-serif)] text-[var(--hab-ink-2)]">
            Free. No signup. Just the facts the city already has on file.
          </p>
        </section>

      </main>

      {/* SECTION 5: FOOTER */}
      <Footer />
    </div>
  );
}
