import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
        <Link href="/" className="text-lg font-display font-bold text-accent">
          Snip.ly
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Dashboard
        </Link>
      </nav>

      <main className="px-6 pb-16 max-w-3xl mx-auto pt-12">
        <h1 className="text-3xl font-display font-bold text-gray-100 mb-8">Privacy Policy</h1>

        <div className="space-y-8 text-sm text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Data We Collect</h2>
            <p>
              Snip.ly collects minimal data to provide analytics on shortened links.
              When a visitor clicks a short URL, we capture:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Timestamp of the click</li>
              <li>HTTP Referrer header (if present)</li>
              <li>Country-level geolocation (via IP, resolved to country only)</li>
              <li>User-Agent string</li>
              <li>A SHA-256 hash of the visitor&apos;s IP address</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">What We Never Store</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Raw IP addresses</strong> — we hash them immediately with SHA-256 and never store or log the original value.</li>
              <li>Browser fingerprints or cookies</li>
              <li>Personal identifying information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Geolocation</h2>
            <p>
              Country-level data is obtained via ip-api.com. Lookups are cached in Redis for 24 hours
              and only a country code (e.g., &quot;US&quot;, &quot;IN&quot;) is stored alongside click events.
              The free tier of ip-api.com limits requests to 45/minute.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Data Retention</h2>
            <p>
              Click events are retained as long as the associated link exists. When a link is deleted,
              all associated click data is automatically removed via cascade delete.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Third Parties</h2>
            <p>
              Snip.ly uses the following third-party services, each with their own privacy policies:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Supabase (PostgreSQL database)</li>
              <li>Upstash (Redis cache and queue)</li>
              <li>ip-api.com (geolocation — free tier, no account required)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Contact</h2>
            <p>
              For privacy concerns or data deletion requests, please open an issue on the
              project repository.
            </p>
          </section>

          <p className="text-xs text-gray-600 pt-4 border-t border-surface-lighter">
            Last updated: April 2026
          </p>
        </div>
      </main>
    </div>
  );
}
