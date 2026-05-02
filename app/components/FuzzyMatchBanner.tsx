interface Props {
  closestMatch?: { searched_address: string; matched_address: string };
}

export default function FuzzyMatchBanner({ closestMatch }: Props) {
  if (!closestMatch) return null;

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--banner-amber-border)", background: "var(--banner-amber-bg)" }}>
      <div className="space-y-1">
        <p className="text-sm text-[var(--hab-ink-2)]">
          You searched for: <span className="text-[var(--hab-ink)]">{closestMatch.searched_address}</span>
        </p>
        <p className="text-sm text-[var(--hab-ink-2)]">
          We matched to: <span className="font-bold" style={{ color: "var(--banner-amber-ink)" }}>{closestMatch.matched_address}</span>
        </p>
      </div>
      <p className="text-xs text-[var(--hab-muted)] mt-2">
        If this isn&apos;t the building you meant, please check the address and search again.
      </p>
    </div>
  );
}
