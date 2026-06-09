import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – FristPilot",
};

// ─────────────────────────────────────────────
// HINWEIS FÜR ENTWICKLER
// Alle mit [PLATZHALTER] markierten Stellen müssen vor dem öffentlichen
// Betrieb durch echte Angaben ersetzt werden.
// Diese Seite stellt keine Rechtsberatung dar.
// ─────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="space-y-10">
        <header>
          <h1 className="text-3xl font-semibold text-ink">
            Datenschutzerklärung
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Stand: {new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long" })}
          </p>
        </header>

        <Section title="1. Verantwortlicher">
          <Placeholder label="Name und Anschrift des Verantwortlichen eintragen" />
          <p className="mt-2 text-sm text-ink-soft">
            Bei Fragen zum Datenschutz wenden Sie sich bitte an:{" "}
            <Placeholder inline label="E-Mail-Adresse eintragen" />
          </p>
        </Section>

        <Section title="2. Welche Daten wir verarbeiten">
          <SubSection title="2.1 Authentifizierung">
            <p>
              Bei der Registrierung und Anmeldung verarbeiten wir Ihre
              E-Mail-Adresse sowie ein verschlüsseltes Passwort. Die
              Authentifizierung erfolgt über{" "}
              <strong>Supabase Auth</strong> (Supabase Inc., USA). Rechtsgrundlage
              ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </p>
          </SubSection>

          <SubSection title="2.2 Dokument-Uploads">
            <p>
              Dokumente (PDF, JPG, PNG), die Sie hochladen, werden auf Servern
              von <strong>Supabase</strong> nur kurzzeitig zur Analyse
              zwischengespeichert und{" "}
              <strong>unmittelbar nach Abschluss der Analyse automatisch
              gelöscht</strong>. Dauerhaft gespeichert wird ausschließlich das
              strukturierte Analyse-Ergebnis (z. B. erkannter Absender,
              Zusammenfassung, mögliche Fristen) – nicht das Originaldokument und
              nicht dessen vollständiger Textinhalt. Jeder Eintrag ist
              ausschließlich Ihrem Nutzerkonto zugeordnet. Andere Nutzer haben
              keinen Zugriff.
            </p>
          </SubSection>

          <SubSection title="2.3 KI-Analyse über Anthropic">
            <p>
              Zur Analyse Ihrer Dokumente werden die Inhalte an den
              KI-Dienstleister <strong>Anthropic, PBC</strong> (San Francisco,
              USA) übermittelt. Anthropic verarbeitet die Daten zur
              Bereitstellung der API-Antwort. Bitte laden Sie{" "}
              <strong>keine Dokumente hoch</strong>, deren Übermittlung an einen
              US-amerikanischen Dienstleister Sie nicht wünschen.
            </p>
            <p className="mt-2">
              Rechtsgrundlage für diese Übermittlung ist Ihre ausdrückliche
              Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO, die Sie vor dem
              ersten Upload erteilen.
            </p>
            <Placeholder
              label="Auftragsverarbeitungsvertrag mit Anthropic dokumentieren und ggf. Standardvertragsklauseln für Drittlandtransfer prüfen (Art. 46 DSGVO)"
              className="mt-3"
            />
          </SubSection>

          <SubSection title="2.4 Nutzungsprotokoll">
            <p>
              Zur Einhaltung von Analysegrenzen speichern wir pro Analyse einen
              anonymisierten Eintrag (Zeitstempel, Ergebnisstatus). Keine
              Dokumentinhalte.
            </p>
          </SubSection>
        </Section>

        <Section title="3. Speicherung und Löschung">
          <p>
            Das hochgeladene Originaldokument wird ausschließlich für die Dauer
            der KI-Analyse zwischengespeichert und danach{" "}
            <strong>automatisch und unwiderruflich gelöscht</strong>. Das
            strukturierte Analyse-Ergebnis bleibt in Ihrem Konto gespeichert,
            bis Sie es in der App löschen oder Ihr Konto schließen. Mit dem
            Löschen werden der Datenbankeintrag sowie alle verknüpften
            Erinnerungen entfernt.
          </p>
        </Section>

        <Section title="4. Weitergabe an Dienstleister">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-ink-soft">
                <th className="py-2 pr-4 font-medium">Dienstleister</th>
                <th className="py-2 pr-4 font-medium">Zweck</th>
                <th className="py-2 font-medium">Sitz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 pr-4">Supabase Inc.</td>
                <td className="py-2 pr-4">Datenbank, Auth, Storage</td>
                <td className="py-2">USA (AWS)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Anthropic, PBC</td>
                <td className="py-2 pr-4">KI-Dokumentanalyse</td>
                <td className="py-2">USA</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  <Placeholder inline label="Hosting-Anbieter eintragen" />
                </td>
                <td className="py-2 pr-4">App-Hosting</td>
                <td className="py-2">
                  <Placeholder inline label="Land eintragen" />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-ink-soft">
            Alle Dienstleister sind als Auftragsverarbeiter gemäß Art. 28 DSGVO
            vertraglich gebunden.{" "}
            <Placeholder inline label="Verträge prüfen und bestätigen" />
          </p>
        </Section>

        <Section title="5. Ihre Rechte">
          <p>Sie haben gemäß DSGVO folgende Rechte:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
            <li>Auskunft über gespeicherte Daten (Art. 15)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16)</li>
            <li>Löschung Ihrer Daten (Art. 17)</li>
            <li>Einschränkung der Verarbeitung (Art. 18)</li>
            <li>Datenübertragbarkeit (Art. 20)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21)</li>
            <li>Widerruf einer Einwilligung (Art. 7 Abs. 3)</li>
          </ul>
          <p className="mt-3 text-sm">
            Zur Ausübung Ihrer Rechte oder zum Widerruf der Einwilligung wenden
            Sie sich an:{" "}
            <Placeholder inline label="Kontakt-E-Mail eintragen" />
          </p>
          <p className="mt-2 text-sm">
            Sie haben außerdem das Recht, sich bei der zuständigen
            Datenschutzaufsichtsbehörde zu beschweren.
          </p>
        </Section>

        <Section title="6. Kontakt">
          <Placeholder label="Datenschutzbeauftragter oder Kontaktperson eintragen" />
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
      <div className="space-y-3 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-ink">{title}</h3>
      <div className="text-sm leading-relaxed text-ink">{children}</div>
    </div>
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
