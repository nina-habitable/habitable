import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Habitable Browser Extension",
  description: "Privacy policy for the Habitable browser extension. What data the extension accesses and how it is used.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-ui)]">
      <header className="border-b border-[var(--hab-line)] bg-[var(--hab-paper)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <Link href="/" className="text-lg font-[family-name:var(--font-serif)] font-bold tracking-tight text-[var(--hab-ink)]">Habitable</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <article className="space-y-8">

          <div>
            <h1 className="text-2xl font-[family-name:var(--font-serif)] font-bold text-[var(--hab-ink)] mb-2">Habitable Browser Extension — Privacy Policy</h1>
            <p className="text-sm text-[var(--muted)]">Last updated: May 11, 2026</p>
          </div>

          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Habitable (&quot;we&quot;) provides a browser extension that surfaces public NYC housing records for buildings listed on rental platforms.
          </p>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">What we collect</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              The extension accesses the address displayed on StreetEasy listing pages you visit. This address is sent to the Habitable API to retrieve public housing records (violations, complaints, litigation, and ownership data) from NYC Open Data sources including HPD, ACRIS, DOB, and 311.
            </p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">
              The extension caches building data locally in your browser (using chrome.storage) so repeat lookups are faster. This cached data stays on your device and is not sent to any third party.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">What we do not collect</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">We do not collect, store, or transmit:</p>
            <ul className="space-y-1 text-sm text-[var(--muted)] leading-relaxed list-disc list-inside">
              <li>Your browsing history</li>
              <li>Your personal information (name, email, account details)</li>
              <li>Which listings you view or how long you view them</li>
              <li>Any data from non-StreetEasy websites</li>
              <li>Cookies or tracking identifiers</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">Data sources</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              All building data displayed by the extension comes from publicly available NYC government datasets. No proprietary or private data is used.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">Third parties</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              We do not sell, share, or transfer any data to third parties. The extension communicates only with the Habitable API (habitable-xi.vercel.app) to retrieve public records.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">Changes</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              If this policy changes, we will update this page with a new date.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-[family-name:var(--font-serif)] font-semibold text-[var(--hab-ink)] mb-3">Contact</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Questions about this policy: <a href="mailto:hello@habitable.nyc" className="text-[var(--hab-ink)] underline hover:opacity-80">hello@habitable.nyc</a>
            </p>
          </div>

        </article>
      </main>
    </div>
  );
}
