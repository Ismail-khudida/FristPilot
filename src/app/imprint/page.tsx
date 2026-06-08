import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum – FristPilot",
};

// ─────────────────────────────────────────────
// HINWEIS FÜR ENTWICKLER
// Alle mit [PLATZHALTER] markierten Stellen müssen vor dem öffentlichen
// Betrieb durch echte, rechtlich korrekte Angaben ersetzt werden.
// Pflicht gemäß § 5 TMG / § 55 RStV.
// ─────────────────────────────────────────────

export default function ImprintPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="space-y-10">
        <header>
          <h1 className="text-3xl font-semibold text-ink">Impressum</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Angaben gemäß § 5 TMG
          </p>
        </header>

        <Section title="Anbieter">
          <Placeholder label="Vollständiger Name (Privatperson oder Firmenname) eintragen" />
          <Placeholder label="Straße und Hausnummer eintragen" className="mt-2" />
          <Placeholder label="PLZ und Ort eintragen" className="mt-2" />
          <Placeholder label="Land eintragen" className="mt-2" />
        </Section>

        <Section title="Kontakt">
          <p>
            E-Mail:{" "}
            <Placeholder inline label="E-Mail-Adresse eintragen" />
          </p>
          <p className="mt-2">
            Telefon:{" "}
            <Placeholder inline label="Telefonnummer eintragen (oder Zeile entfernen)" />
          </p>
        </Section>

        <Section title="Verantwortlich für Inhalte (§ 55 Abs. 2 RStV)">
          <Placeholder label="Name und Anschrift der verantwortlichen Person eintragen (muss nicht identisch mit dem Anbieter sein)" />
        </Section>

        <Section title="Handelsregister / Sonstige Angaben">
          <Placeholder label="Handelsregisternummer, Umsatzsteuer-ID o.ä. eintragen – oder diesen Abschnitt entfernen, falls nicht zutreffend" />
        </Section>

        <Section title="Haftungshinweis">
          <p className="text-sm leading-relaxed text-ink">
            FristPilot analysiert Dokumente mithilfe künstlicher Intelligenz und
            gibt Hinweise auf mögliche Fristen. Die Ergebnisse stellen{" "}
            <strong>keine Rechtsberatung</strong> dar und können Fehler
            enthalten. Für Vollständigkeit und Richtigkeit wird keine Haftung
            übernommen. Bitte prüfen Sie wichtige Fristen selbst oder konsultieren
            Sie eine Fachperson.
          </p>
        </Section>

        <div className="border-t pt-6 text-sm text-ink-soft">
          <Link href="/" className="text-navy underline">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function Placeholder({
  label,
  inline = false,
  className = "",
}: {
  label: string;
  inline?: boolean;
  className?: string;
}) {
  const base =
    "rounded border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700";
  if (inline) {
    return <span className={base}>[{label}]</span>;
  }
  return <div className={`${base} ${className}`}>[{label}]</div>;
}
