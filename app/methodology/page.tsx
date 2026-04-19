import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How the Habitable Score Works — Methodology | Habitable",
  description: "Habitable's building score compares NYC properties against peers of similar size using open HPD, ACRIS, and 311 records. Read the full methodology.",
  openGraph: {
    title: "How the Habitable Score Works — Methodology | Habitable",
    description: "Habitable's building score compares NYC properties against peers of similar size using open HPD, ACRIS, and 311 records. Read the full methodology.",
    type: "website",
    url: "https://habitable-xi.vercel.app/methodology",
  },
  twitter: {
    card: "summary",
    title: "How the Habitable Score Works — Methodology | Habitable",
    description: "Habitable's building score compares NYC properties against peers of similar size using open HPD, ACRIS, and 311 records.",
  },
};

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)] underline hover:opacity-80">{children}</a>;
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--foreground)]">Habitable</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <article className="space-y-8">

          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">How the Habitable Score Works</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The Habitable Score is a peer comparison based on public records. It shows how a building&apos;s open violation, complaint, litigation, and bed bug history compares to other NYC buildings of similar size. It is not a rating, a verdict, or a recommendation.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">This page explains exactly how the score is calculated, what data it uses, and what it does not capture. If you are about to sign a lease, we want you to understand the score well enough to decide how much weight to give it.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">What the score is</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The Habitable Score shows where a building sits among its peers. A score of &quot;Better than 70%&quot; means the building has fewer weighted issues per unit than 70% of comparable NYC buildings in the last two years.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The score is based on records, not opinions. We do not currently inspect buildings, interview tenants, or collect reviews. Everything that goes into the score is publicly filed with New York City and available for anyone to verify.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The score is informational. It is one input into a leasing decision, not a replacement for visiting a property, asking questions, or doing your own research.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">What the score is not</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The Habitable Score is not a rating or a grade. There are no letter grades and no thresholds for &quot;good&quot; or &quot;bad.&quot;</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The Habitable Score is not a verdict on a landlord. A landlord may own many buildings. The score reflects one building&apos;s record, not the landlord&apos;s overall performance.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The Habitable Score is not legal, financial, or real estate advice. It does not predict whether a specific apartment will have problems, whether a lease is fair, or whether a landlord will be responsive.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The Habitable Score does not capture everything. Sections below explain the specific gaps.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Data sources</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">The score is calculated from 12 NYC public datasets, all freely accessible through NYC Open Data. Each dataset is linked below for verification:</p>
            <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed">
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5">HPD Housing Code Violations</ExtLink>: open violations classified A (non-hazardous), B (hazardous), C (immediately hazardous), and I (information/order)</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Complaints-and-Problems/ygpa-z7cr">HPD Complaints</ExtLink>: complaints filed with HPD, grouped by category and emergency status</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Housing-Litigations/59kj-x8nc">HPD Housing Litigation</ExtLink>: court cases involving the building</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Order-to-Repair-Vacate-Orders/tb8q-a3ar">HPD Vacate Orders</ExtLink>: orders that require tenants to leave due to unsafe conditions</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Bedbug-Reporting/wz6d-d3jb">HPD Bed Bug Annual Reports</ExtLink>: landlord-filed annual reports on bed bug activity</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Buildings-Subject-to-HPD-Jurisdiction/kj4p-ruqc">HPD Buildings</ExtLink>: building metadata including unit count and stories</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Multiple-Dwelling-Registrations/tesw-yqqr">HPD Registration</ExtLink>: landlord registration records</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Registration-Contacts/feu5-w2e2">HPD Registration Contacts</ExtLink>: registered owners, managing agents, and officers</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Buildings-Selected-for-the-Alternative-Enforcement/hcir-3275">HPD Alternative Enforcement Program</ExtLink>: the city&apos;s watchlist for the worst-conditioned buildings</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9">311 Service Requests</ExtLink>: complaints filed with non-HPD agencies (DOB, FDNY, DEP, DOHMH)</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Recent-Lead-Paint-Violations/v574-pyre">HPD Lead Paint Violations</ExtLink>: open lead paint violations at the apartment level</li>
              <li><ExtLink href="https://data.cityofnewyork.us/Housing-Development/Open-Market-Order-OMO-Charges/mdbu-nrqn">HPD Emergency Work Orders</ExtLink>: repairs the city performed itself because the landlord failed to act</li>
            </ul>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Ownership and deed history use three ACRIS datasets: <ExtLink href="https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Legals/8h5j-fqxa">Legals</ExtLink>, <ExtLink href="https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Master/bnx9-e6tj">Master</ExtLink>, and <ExtLink href="https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Parties/636b-3b5g">Parties</ExtLink>. ACRIS data is displayed on property pages but is not part of the score calculation.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">All data is fetched live from NYC Open Data and cached for 24 hours. Records are as current as NYC&apos;s public systems.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Peer groups</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Buildings are compared against peers of similar size. A 200-unit building and a 5-unit building have very different typical violation counts, so a single citywide comparison would be misleading.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The six peer groups are based on legal unit count from HPD Buildings:</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)] list-disc list-inside">
              <li>1 to 10 units</li>
              <li>11 to 25 units</li>
              <li>26 to 50 units</li>
              <li>51 to 100 units</li>
              <li>101 to 200 units</li>
              <li>201 or more units</li>
            </ul>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">If a building&apos;s unit count is not in HPD&apos;s records, no score is shown. We use the phrase &quot;Score unavailable: unit count not found in HPD records&quot; rather than guessing a peer group.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">How the score is calculated</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The score is a weighted percentile across six factors. Each factor is calculated per unit where applicable, so small and large buildings are compared on equal footing.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The weights are:</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)] list-disc list-inside">
              <li>Open violations per unit: 30%</li>
              <li>Class C (immediately hazardous) violations per unit: 25%</li>
              <li>Complaints per unit: 15%</li>
              <li>Alternative Enforcement Program (AEP) watchlist status: 15%</li>
              <li>Housing litigation: 10%</li>
              <li>Bed bug reports: 5%</li>
            </ul>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">For each factor, the building&apos;s value is compared to the distribution of values across all active NYC buildings in the same peer group. The comparison uses percentile thresholds calculated from a one-time analysis of 317,872 NYC buildings.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">The final score is the weighted average of the individual percentile rankings. Higher percentiles indicate fewer issues relative to peers.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Why these weights</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The weights are judgment calls grounded in four principles: severity, enforceability, renter-relevance, and base-rate frequency. No scoring system of this kind has a mathematically &quot;correct&quot; answer. Any weighted composite reflects choices about what matters most. Ours are explained below so you can decide whether you agree with them.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Open violations per unit: 30%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Violations are the most comprehensive signal HPD produces. Every open violation represents a city inspector&apos;s finding that a condition fails the housing code. Weighting by &quot;per unit&quot; rather than absolute count is critical. A 100-unit building with 50 open violations is in very different condition than a 4-unit building with the same count. This is the largest weight because violations are the most common, most consistently recorded, and most directly renter-facing indicator in the dataset.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Class C (immediately hazardous) violations per unit: 25%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">HPD classifies violations by severity. Class A (non-hazardous) must be corrected within 90 days. Class B (hazardous) within 30 days. Class C represents conditions serious enough that the city requires correction within 24 hours, such as lead paint hazards, inadequate heat or hot water in winter, missing smoke detectors, and structural hazards. A single Class C violation is more consequential for a renter than a handful of Class A violations. We weight Class C separately and heavily because the 24-hour deadline reflects genuine urgency, not a matter of paperwork. Combined with the 30% weight on all open violations, half the score is driven by violation severity and volume.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Complaints per unit: 15%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Complaints are tenant-reported conditions that may or may not result in a violation. They are a leading indicator, often surfacing problems before they become inspected and cited. But complaints are noisier than violations. They include disputes that turn out to be unfounded, duplicates, and tenant-landlord conflicts. We weight complaints meaningfully because they add signal, but lower than violations because of the noise.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Alternative Enforcement Program (AEP) status: 15%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">AEP is HPD&apos;s designation for the worst-conditioned buildings in New York City, selected each January based on the ratio of hazardous and immediately hazardous violations issued in the preceding five years. A building is placed on AEP only after a sustained pattern of severe unresolved violations. When a building is actively on AEP, we do not display a percentile score at all. The AEP banner is the signal, and no composite percentile can reasonably override it. The 15% weight applies when AEP status is historical, meaning the building was discharged from the program after corrections were made. Past AEP designation still meaningfully influences the score because it indicates chronic building-wide neglect.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Housing litigation: 10%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Housing court cases are a lagging indicator of chronic conditions. Litigation is a powerful signal but occurs less frequently than violations or complaints. The 10% weight reflects its relative weight in the landscape of available data, not a judgment that legal action matters less than repair conditions.</p>

            <h3 className="text-sm font-semibold text-[var(--foreground)] mt-5 mb-2">Bed bug reports: 5%</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Landlords of multiple dwellings with three or more units are required to file annual bed bug reports with HPD under Local Law 69. The reports capture total dwelling units, units with infestations, units where eradication was performed, and units re-infested after eradication. Bed bugs are a significant quality-of-life concern and one of the most-searched renter fears. The data has limits. Filings are landlord-reported based on &quot;best efforts&quot; to collect information from tenants. Frequency is annual rather than real-time. A single bad year does not necessarily reflect current conditions. We include bed bugs as a factor because renters ask about them, but at a low weight because of these data limitations.</p>

            <p className="text-sm text-[var(--muted)] leading-relaxed mt-5">These weights may be revised over time. Any changes will be documented on this page.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Time window</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The score uses a rolling two-year window by default. This reflects current conditions more accurately than all-time counts, which can be dominated by historical issues that have long since been resolved.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Every building page includes an &quot;All time&quot; toggle that switches the display to the building&apos;s full record. When toggled, the underlying data changes but the percentile thresholds remain based on the two-year distribution. All-time scores therefore tend to skew lower than recent scores. We flag this limitation explicitly on the page.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Status filter</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Violations are counted as open unless they are in one of seven closed statuses:</p>
            <ol className="mt-2 space-y-1 text-sm text-[var(--muted)] list-decimal list-inside">
              <li>VIOLATION CLOSED</li>
              <li>VIOLATION DISMISSED</li>
              <li>NOV CERTIFIED LATE</li>
              <li>NOV CERTIFIED ON TIME</li>
              <li>INFO NOV SENT OUT</li>
              <li>LEAD DOCS SUBMITTED ACCEPTABLE</li>
              <li>CERTIFICATION POSTPONEMENT GRANTED</li>
            </ol>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Every building page shows two violation counts side by side: &quot;require action&quot; (a stricter filter that matches HPD&apos;s own enforcement view) and &quot;total open&quot; (all violations not in the seven closed statuses above). This is intentional. Different filters give different numbers, and we would rather show both than hide the discrepancy.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Special cases</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed"><strong>Buildings on the AEP watchlist.</strong> The Alternative Enforcement Program is HPD&apos;s designation for the worst-conditioned buildings in New York City. When a building is actively on AEP, we do not display a percentile score. Instead, we show an AEP banner. The banner is the signal.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3"><strong>Clean buildings.</strong> When a building has no open violations, no recent complaints, and no litigation in the selected time window, we display &quot;Clean record&quot; rather than a percentile. Some clean buildings had past issues that were resolved. Those are shown as &quot;No open violations. X violations were issued and closed and Y complaints filed in the last 2 years,&quot; so readers can see the history.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3"><strong>Condo and co-op buildings.</strong> Condos and co-ops register at the unit level in HPD&apos;s system, while violation data is filed at the building level. When a search resolves to a unit BBL, we show a message explaining that the building-level record may be accessed under a different identifier. Condos and co-ops also often list a homeowners&apos; association as the &quot;owner,&quot; which is not the same as the renter&apos;s landlord.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">What the score does not capture</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">Honesty about limits matters more than claims about coverage. Here is what the Habitable Score does not include:</p>
            <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed list-disc list-inside">
              <li><strong>Department of Buildings (DOB) construction violations.</strong> These are available through 311 service requests but not through HPD&apos;s housing code dataset. They are displayed on building pages but do not factor into the score.</li>
              <li><strong>Private lawsuits outside housing court.</strong> The litigation dataset covers HPD-related housing court cases only.</li>
              <li><strong>Tenant reviews.</strong> Habitable does not yet collect or display tenant reviews. When we do, they will be separated from the score.</li>
              <li><strong>Recent changes in ownership.</strong> A building&apos;s record reflects the property, not the current owner. A building with a history of violations under a prior landlord will show that history even if a new owner has since taken over.</li>
              <li><strong>Building age or renovation status.</strong> We do not adjust the score for age or capital improvements.</li>
              <li><strong>Rent stabilization status.</strong> Rent stabilization is meaningful for renters but is not a scoring factor.</li>
              <li><strong>Anything not filed with the City of New York.</strong> Informal complaints, non-reporting issues, and unfiled disputes are invisible to public records.</li>
            </ul>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">If a building feels off when you visit and the score looks fine, trust your observation. The score is a floor, not a ceiling.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Data accuracy and updates</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Violation counts have been validated against HPD Online at 90% to 99.8% accuracy across test buildings, depending on the building. Remaining discrepancies are due to different status filter definitions, which is why we show both &quot;require action&quot; and &quot;total open&quot; counts on every building page.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Data is refreshed from NYC Open Data on each property lookup and cached for 24 hours. A property page displays &quot;Last updated: [timestamp]&quot; at the bottom. If records have changed in the last 24 hours, the next lookup after the cache expires will reflect them.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Percentile thresholds are based on a full-dataset snapshot of 317,872 NYC buildings. The distribution does not shift dramatically month to month, but thresholds are scheduled for quarterly regeneration to prevent drift.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Errors and corrections</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">Public records contain errors. If you believe the record displayed for a specific building is wrong, the authoritative source is NYC Open Data directly. Habitable does not edit NYC records. We surface and summarize them.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">If you notice a bug in how Habitable displays a record, or a case where our summary clearly misrepresents the underlying data, please contact <a href="mailto:habitable.feedback@gmail.com" className="text-[var(--foreground)] underline hover:opacity-80">habitable.feedback@gmail.com</a>.</p>
          </div>

          <div className="border-t border-[var(--card-border)] pt-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Disclaimer</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">The Habitable Score is based on publicly available New York City records. Records may contain errors, omissions, or delays that affect the score. This information is provided for informational purposes only and is not legal, financial, or real estate advice. It is not a substitute for your own due diligence, visiting a property, asking questions, or consulting a housing attorney.</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">Habitable is not affiliated with the City of New York, the Department of Housing Preservation and Development, or any listing platform including StreetEasy or Zillow.</p>
          </div>

        </article>
      </main>
    </div>
  );
}
