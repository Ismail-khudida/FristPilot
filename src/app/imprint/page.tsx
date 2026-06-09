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
          <p>Ismail Khudida</p>
          <p className="mt-2">Bückeburger Str. 14</p>
          <p className="mt-2">32457 Porta Westfalica</p>
          <p className="mt-2">Deutschland</p>
        </Section>

        <Section title="Kontakt">
          <p>
            E-Mail:{" "}
            <a href="mailto:ismail.khudida@recmo.de" className="text-navy underline">
              ismail.khudida@recmo.de
            </a>
          </p>
        </Section>

        <Section title="Verantwortlich für Inhalte (§ 55 Abs. 2 RStV)">
          <p>Ismail Khudida, Anschrift wie oben.</p>
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
