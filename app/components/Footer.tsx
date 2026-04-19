import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-12 py-6">
      <div className="mx-auto max-w-2xl px-5 space-y-2">
        <div className="flex items-center gap-4 text-[10px] text-[var(--muted-dim)]">
          <Link href="/methodology" className="hover:text-[var(--muted)]">How the Habitable Score Works</Link>
        </div>
        <p className="text-[10px] text-[var(--muted-dim)]">Habitable is informational and not legal, financial, or real estate advice.</p>
        <p className="text-[10px] text-[var(--muted-dim)]">Data from NYC Open Data (HPD, ACRIS, 311, DOB).</p>
        <p className="text-[10px] text-[var(--muted-dim)]">&copy; 2026 Habitable</p>
      </div>
    </footer>
  );
}
