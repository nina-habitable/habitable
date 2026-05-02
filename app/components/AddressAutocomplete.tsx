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
  onSubmit: (params: { address: string }) => void;
  onSelect: (s: Suggestion) => void;
  variant?: "hero" | "compact";
}

export default function AddressAutocomplete({ initialAddress = "", onSubmit, onSelect, variant = "compact" }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userTypedRef = useRef(false);

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

  useEffect(() => {
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
          .filter((s: Suggestion) => s.bbl);

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
            const aStreet = stripHouse(a.name);
            const bStreet = stripHouse(b.name);
            if (aStreet.length !== bStreet.length) return aStreet.length - bStreet.length;
            return aStreet.localeCompare(bStreet);
          });
        }

        setSuggestions(parsed.slice(0, 8));
        setHighlightIndex(-1);
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
  }, [address]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    userTypedRef.current = false;
    setSuggestions([]);
    setShowDropdown(false);
    onSubmit({ address: address.trim() });
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
    ? "flex-1 rounded-lg border border-[var(--hab-line)] bg-[var(--hab-paper)] px-4 py-3 text-sm text-[var(--hab-ink)] placeholder:text-[var(--hab-muted)] outline-none focus:border-[var(--hab-muted)] focus:ring-1 focus:ring-[var(--hab-muted)]"
    : "flex-1 rounded-lg border border-[var(--hab-line)] bg-[var(--hab-bg)] px-4 py-2 text-sm text-[var(--hab-ink)] placeholder:text-[var(--hab-muted)] outline-none focus:border-[var(--hab-muted)] focus:ring-1 focus:ring-[var(--hab-muted)]";
  const buttonClasses = isHero
    ? "rounded-lg bg-[var(--hab-ink)] px-5 py-3 text-sm font-medium text-[var(--hab-paper)] hover:opacity-90"
    : "rounded-lg bg-[var(--hab-ink)] px-4 py-2 text-sm font-medium text-[var(--hab-paper)] hover:opacity-90";

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => {
            userTypedRef.current = true;
            if (abortRef.current) abortRef.current.abort();
            setSuggestions([]);
            setHighlightIndex(-1);
            setShowDropdown(false);
            setAddress(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!showDropdown || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((prev) => Math.max(prev - 1, -1));
            } else if (e.key === "Enter" && highlightIndex >= 0) {
              e.preventDefault();
              handleSelect(suggestions[highlightIndex]);
            }
          }}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Enter address (e.g., 553 Howard Ave)"
          autoComplete="off"
          className={inputClasses}
        />
        <button type="submit" className={buttonClasses}>Search</button>
      </form>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-[var(--hab-line)] bg-[var(--hab-paper)] shadow-lg overflow-hidden">
          {loading && <div className="px-4 py-2 text-xs text-[var(--hab-muted)]">Loading...</div>}
          {suggestions.map((s, i) => (
            <button
              key={s.bbl}
              type="button"
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`w-full text-left px-4 py-2.5 border-b border-[var(--hab-line)] last:border-b-0 transition-colors ${i === highlightIndex ? "bg-[var(--hab-surface)]" : "hover:bg-[var(--hab-surface)]"}`}
            >
              <p className="text-sm text-[var(--hab-ink)]">{s.name}</p>
              <p className="text-[10px] text-[var(--hab-muted)]">
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
