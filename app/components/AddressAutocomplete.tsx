"use client";

import { useState, useEffect, useRef, FormEvent } from "react";

interface Suggestion {
  bbl: string;
  bin: string;
  name: string;
  borough: string;
  neighbourhood: string;
  label: string;
  coords: string;
}

interface Props {
  initialAddress?: string;
  initialBorough?: string;
  onSubmit: (params: { address: string; borough: string }) => void;
  onSelect: (s: Suggestion) => void;
  variant?: "hero" | "compact";
}

export default function AddressAutocomplete({ initialAddress = "", initialBorough = "", onSubmit, onSelect, variant = "compact" }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [borough, setBorough] = useState(initialBorough);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userTypedRef = useRef(false);

  // Click outside or Escape to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDropdown(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Debounced autocomplete fetch
  useEffect(() => {
    // Only fetch when the user has actually typed (not on mount or after selection)
    if (!userTypedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (address.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const currentInput = address;
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(
          `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(currentInput)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        const parsed: Suggestion[] = (data.features || [])
          .map((f: { properties: { name?: string; borough?: string; neighbourhood?: string; label?: string; addendum?: { pad?: { bbl?: string; bin?: string } } }; geometry?: { coordinates?: [number, number] } }) => {
            const bbl = f.properties.addendum?.pad?.bbl || "";
            const bin = f.properties.addendum?.pad?.bin || "";
            const [lng, lat] = f.geometry?.coordinates || [];
            return {
              bbl,
              bin,
              name: f.properties.name || "",
              borough: f.properties.borough || "",
              neighbourhood: f.properties.neighbourhood || "",
              label: f.properties.label || "",
              coords: lat && lng ? `${lat},${lng}` : "",
            };
          })
          .filter((s: Suggestion) => s.bbl)
          .filter((s: Suggestion) => !borough || s.borough === borough);

        // Extract street prefix from input (after house number) for prioritization
        const streetPrefix = currentInput.trim().toUpperCase().replace(/^\d+[-\d]*\s*/, "").trim();
        const stripHouse = (n: string) => n.toUpperCase().replace(/^\d+[-\d]*\s*/, "").trim();

        if (streetPrefix.length > 0) {
          const score = (s: Suggestion) => {
            const street = stripHouse(s.name);
            if (street.startsWith(streetPrefix)) return 0;
            if (street.includes(streetPrefix)) return 1;
            return 2;
          };
          parsed.sort((a: Suggestion, b: Suggestion) => {
            const sa = score(a), sb = score(b);
            if (sa !== sb) return sa - sb;
            // Within same group: shorter street name first (better match), then alphabetical
            const aStreet = stripHouse(a.name);
            const bStreet = stripHouse(b.name);
            if (aStreet.length !== bStreet.length) return aStreet.length - bStreet.length;
            return aStreet.localeCompare(bStreet);
          });
        }

        setSuggestions(parsed.slice(0, 8));
        setShowDropdown(parsed.length > 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [address, borough]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    userTypedRef.current = false;
    setSuggestions([]);
    setShowDropdown(false);
    onSubmit({ address: address.trim(), borough });
  }

  function handleSelect(s: Suggestion) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    userTypedRef.current = false;
    setSuggestions([]);
    setShowDropdown(false);
    setAddress(s.name);
    onSelect(s);
  }

  const isHero = variant === "hero";
  const inputClasses = isHero
    ? "flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-dim)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
    : "flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-dim)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]";
  const selectClasses = isHero
    ? "rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]"
    : "rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] focus:ring-1 focus:ring-[var(--muted)]";
  const buttonClasses = isHero
    ? "rounded-lg bg-[var(--foreground)] px-5 py-3 text-sm font-medium text-[var(--background)] hover:opacity-90"
    : "rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90";

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => { userTypedRef.current = true; setAddress(e.target.value); }}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Enter address (e.g., 553 Howard Ave, Brooklyn)"
          autoComplete="off"
          className={inputClasses}
        />
        <select value={borough} onChange={(e) => setBorough(e.target.value)} className={selectClasses}>
          <option value="">{isHero ? "Any borough" : "Any"}</option>
          <option value="Manhattan">Manhattan</option>
          <option value="Brooklyn">Brooklyn</option>
          <option value="Queens">Queens</option>
          <option value="Bronx">Bronx</option>
          <option value="Staten Island">{isHero ? "Staten Island" : "Staten Is."}</option>
        </select>
        <button type="submit" className={buttonClasses}>{isHero ? "Search" : "Search"}</button>
      </form>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-lg overflow-hidden">
          {loading && <div className="px-4 py-2 text-xs text-[var(--muted-dim)]">Loading...</div>}
          {suggestions.map((s) => (
            <button
              key={s.bbl}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-[var(--background)] border-b border-[var(--card-border)] last:border-b-0 transition-colors"
            >
              <p className="text-sm text-[var(--foreground)]">{s.name}</p>
              <p className="text-[10px] text-[var(--muted-dim)]">
                {s.borough}{s.neighbourhood ? `, ${s.neighbourhood}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Suggestion };
