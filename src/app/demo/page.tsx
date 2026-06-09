import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Beispiel-Analyse – FristPilot",
  description:
    "So sieht eine FristPilot-Analyse aus – an einem Beispiel, ganz ohne eigenes Dokument.",
};

// Statische Beispiel-Analyse. Bewusst ohne Datenbank/Upload, damit zögernde
// Nutzer das Ergebnis risikofrei sehen, bevor sie echte Post hochladen.
export default function DemoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="space-y-6">
        <div>
          <Link href="/" className="text-sm text-navy underline">
            ← Zurück zur Startseite
          </Link>
          <div className="mt-3 inline-flex items-center rounded-full border border-navy/20 bg-navy/5 px-3 py-1 text-xs font-medium text-navy">
            Beispiel · kein echtes Dokument nötig
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-ink">
            So sieht eine FristPilot-Analyse aus
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Das Beispiel zeigt, was FristPilot aus einem typischen Brief macht –
            damit du weißt, was dich erwartet, bevor du etwas hochlädst.
          </p>
        </div>

        {/* Übersicht */}
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-navy/10 px-3 py-1 text-xs font-medium text-navy">
                Versicherung
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Mittleres Risiko
              </span>
            </div>
            <span className="text-xs font-medium text-green-700">
              KI-Sicherheit: Hoch (88%)
            </span>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-soft">Absender</h2>
            <p className="text-ink">Muster Kfz-Versicherung AG</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-soft">
              Was steht in diesem Dokument?
            </h2>
            <p className="leading-relaxed text-ink">
              Deine Kfz-Versicherung verlängert sich automatisch um ein weiteres
              Jahr, wenn du nicht kündigst. Möchtest du wechseln oder kündigen,
              musst du das rechtzeitig vor Ablauf schriftlich tun. Es besteht
              kein akuter Handlungsdruck, aber eine wichtige Frist.
            </p>
          </div>
        </div>

        {/* Mögliche Frist */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Mögliche Fristen</h2>
          <div className="card space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-base">🗓️</span>
              <span className="text-sm text-blue-700">Frist in 24 Tagen</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                Mögliche Kündigungsfrist erkannt
              </span>
              <span className="text-xs font-medium text-green-700">
                KI-Sicherheit: Hoch (85%)
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Datum
              </p>
              <p className="text-base font-semibold text-ink">30. November</p>
              <p className="mt-1 text-sm text-ink-soft">
                Wahrscheinlich ist bis zum 30. November eine Reaktion
                erforderlich.
              </p>
            </div>

            <p className="text-sm text-ink">
              Letzter Termin, um der automatischen Verlängerung zu widersprechen
              oder zu kündigen.
            </p>

            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft">
              <span className="font-medium text-ink">Wahrscheinlich zu tun: </span>
              Falls du wechseln möchtest, bis zum 30. November schriftlich
              kündigen.
            </p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Grundlage im Dokument
              </p>
              <blockquote className="mt-1 border-l-2 border-navy/30 pl-3 text-sm italic text-ink-soft">
                „Der Vertrag verlängert sich automatisch um ein Jahr, sofern er
                nicht bis zum 30.11. schriftlich gekündigt wird."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Empfohlene Schritte */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Empfohlene nächste Schritte
          </h2>
          <ul className="card space-y-2">
            <li className="flex gap-2 text-sm text-ink">
              <span className="text-navy">•</span>
              <span>
                Prüfen, ob die Konditionen noch passen oder ein Wechsel günstiger
                wäre.
              </span>
            </li>
            <li className="flex gap-2 text-sm text-ink">
              <span className="text-navy">•</span>
              <span>Bei Wunsch zu kündigen: rechtzeitig vor dem 30.11. handeln.</span>
            </li>
            <li className="flex gap-2 text-sm text-ink">
              <span className="text-navy">•</span>
              <span>Diese Frist als Erinnerung speichern, um sie nicht zu vergessen.</span>
            </li>
          </ul>
        </section>

        {/* CTA */}
        <div className="rounded-xl border border-navy/20 bg-navy/5 p-6 text-center">
          <p className="font-semibold text-ink">
            Genau das macht FristPilot mit deinen eigenen Briefen.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Das Originaldokument wird nach der Analyse automatisch gelöscht.
          </p>
          <Link href="/register" className="btn-primary mt-4 inline-flex">
            Jetzt kostenlos starten
          </Link>
        </div>
      </div>
    </main>
  );
}
