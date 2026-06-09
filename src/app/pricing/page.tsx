import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preise – FristPilot",
  description: "FristPilot kostenlos testen. Keine Kreditkarte erforderlich.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold text-navy">FristPilot</Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink">Anmelden</Link>
            <Link href="/register" className="btn-primary text-sm">Kostenlos starten</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-navy/20 bg-navy/5 px-4 py-1.5 text-xs font-medium text-navy">
          Beta-Phase · Jetzt kostenlos
        </div>
        <h1 className="mt-4 text-4xl font-bold text-ink">
          Einfache, faire Preise
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          In der Beta-Phase ist FristPilot vollständig kostenlos.
          Du hilfst uns mit deinem Feedback, das Produkt besser zu machen.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Beta / Free */}
          <div className="card relative border-2 border-navy">
            <div className="absolute -top-3 left-6 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">
              Aktuell verfügbar
            </div>
            <div className="mb-6 mt-2">
              <h2 className="text-xl font-bold text-ink">Beta</h2>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-bold text-ink">Kostenlos</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">Während der Testphase</p>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              {[
                "Unbegrenzte Dokumente (PDF, JPG, PNG)",
                "KI-Analyse mit Fristerkennung",
                "Einfache Erklärung auf Deutsch",
                "Erinnerungen & Dashboard",
                "DSGVO-konform",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-ink">
                  <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="btn-primary w-full text-center">
              Jetzt kostenlos starten
            </Link>
          </div>

          {/* Pro (coming soon) */}
          <div className="card opacity-70">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink">Pro</h2>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-bold text-ink">€4,99</span>
                <span className="mb-1 text-sm text-ink-soft">/ Monat</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">Bald verfügbar</p>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              {[
                "Alles aus Beta",
                "E-Mail-Erinnerungen vor Fristen",
                "Dokumentenarchiv & Suche",
                "Prioritäts-Analyse",
                "Persönlicher Support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-ink-soft">
                  <svg className="h-4 w-4 shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button disabled className="btn-secondary w-full cursor-not-allowed opacity-50">
              Demnächst verfügbar
            </button>
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-gray-200 bg-surface-muted p-6 text-center">
          <h3 className="font-semibold text-ink">Fragen zu den Preisen?</h3>
          <p className="mt-2 text-sm text-ink-soft">
            In der Beta-Phase ist alles kostenlos. Kein Abo, keine Kreditkarte.
            Du kannst dein Konto jederzeit löschen.
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-soft">
          <span>© 2025 FristPilot</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Datenschutz</Link>
            <Link href="/imprint" className="hover:underline">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
