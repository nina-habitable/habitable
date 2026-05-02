import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--hab-line)] mt-12 py-6">
      <div className="mx-auto max-w-2xl px-5 space-y-2">
        <div className="flex items-center gap-4 text-[10px] text-[var(--hab-muted)]">
          <Link href="/methodology" className="hover:text-[var(--hab-ink)]">How the Habitable Score Works</Link>
        </div>
        <p className="text-[10px] text-[var(--hab-muted)]">Habitable is informational and not legal, financial, or real estate advice.</p>
        <p className="text-[10px] text-[var(--hab-muted)]">Data from NYC Open Data (HPD, ACRIS, 311, DOB).</p>
        <p className="text-[10px] text-[var(--hab-muted)]">&copy; 2026 Habitable</p>
      </div>
    </footer>
  );
}
