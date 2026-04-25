interface Props {
  closestMatch?: { searched_address: string; matched_address: string };
}

export default function FuzzyMatchBanner({ closestMatch }: Props) {
  if (!closestMatch) return null;

  return (
    <div className="rounded-xl border border-[#3D2E0A] bg-[#2E2810] p-4 mb-4">
      <div className="space-y-1">
        <p className="text-sm text-[var(--muted)]">
          You searched for: <span className="text-[var(--foreground)]">{closestMatch.searched_address}</span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          We matched to: <span className="font-bold text-[#FFB020]">{closestMatch.matched_address}</span>
        </p>
      </div>
      <p className="text-xs text-[var(--muted-dim)] mt-2">
        If this isn&apos;t the building you meant, please check the address and search again.
      </p>
    </div>
  );
}
