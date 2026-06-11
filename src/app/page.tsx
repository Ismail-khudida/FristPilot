import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold text-navy">FristPilot</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink">
              Anmelden
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-navy/20 bg-navy/5 px-4 py-1.5 text-xs font-medium text-navy">
          Closed Beta · Kostenlos in der Testphase
        </div>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-ink sm:text-5xl">
          Verpasse keine<br />
          <span className="text-navy">Frist mehr.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          FristPilot liest deine Briefe, erkennt was wichtig ist und zeigt dir
          genau, <strong className="font-semibold text-ink">was du bis wann tun
          musst</strong> — von der Krankenkasse über Versicherungen bis zur
          Mahnung.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className="btn-primary px-8 py-3 text-base">
            Jetzt kostenlos testen
          </Link>
          <Link href="/demo" className="btn-secondary px-8 py-3 text-base">
            Beispiel ansehen
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Kein Abo · Keine Kreditkarte · Einfach loslegen
        </p>
      </section>

      {/* Beispiel-Karten: konkrete Frist + Handlung */}
      <section className="mx-auto -mt-6 max-w-5xl px-4 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              tag: "Krankenkasse",
              tagClass: "bg-blue-50 text-blue-700",
              title: "Nachweis einreichen",
              due: "bis 14.07.",
              action: "Einkommensnachweis hochladen",
            },
            {
              tag: "Versicherung",
              tagClass: "bg-amber-50 text-amber-700",
              title: "Vertrag verlängert sich automatisch",
              due: "Kündigung bis 30.11.",
              action: "Prüfen oder kündigen",
            },
            {
              tag: "Rechnung",
              tagClass: "bg-accent-soft text-accent",
              title: "Zahlung offen",
              due: "fällig bis 02.07.",
              action: "Überweisen, Mahngebühr vermeiden",
            },
          ].map((c) => (
            <div key={c.tag} className="card text-left">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${c.tagClass}`}>
                {c.tag}
              </span>
              <p className="mt-3 font-semibold text-ink">{c.title}</p>
              <p className="mt-1 text-sm font-medium text-navy">{c.due}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
                <span className="text-navy">→</span>
                {c.action}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-soft">
          So sieht das Ergebnis aus — neugierig?{" "}
          <Link href="/demo" className="text-navy underline">
            Komplettes Beispiel ansehen
          </Link>
        </p>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-gray-100 bg-surface-muted py-6">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-ink-soft">
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Originaldokument wird nach der Analyse automatisch gelöscht
            </span>
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verschlüsselte Übertragung · Analyse transparent ausgewiesen
            </span>
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              PDF, JPG und PNG unterstützt
            </span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              emoji: "📬",
              title: "Behördenpost",
              text: "Amtliche Briefe sind oft unverständlich. FristPilot erklärt sie in klarer Sprache — ohne Fachwissen.",
            },
            {
              emoji: "⚠️",
              title: "Versteckte Fristen",
              text: "In Versicherungen, Rechnungen und Mahnungen stecken Fristen. FristPilot findet sie, bevor es zu spät ist.",
            },
            {
              emoji: "🗓️",
              title: "Erinnerungen",
              text: "Erkannte Fristen werden direkt als Erinnerung gespeichert — damit du rechtzeitig handelst.",
            },
          ].map((item) => (
            <div key={item.title} className="card text-center">
              <div className="mb-3 text-4xl">{item.emoji}</div>
              <h3 className="mb-2 font-semibold text-ink">{item.title}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="so-funktioniert-es" className="bg-surface-muted py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">
            So einfach geht's
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Dokument hochladen",
                text: "Brief, Rechnung, Versicherung oder Behördenpost als PDF oder Foto hochladen. Fertig in Sekunden.",
              },
              {
                step: "2",
                title: "FristPilot analysiert",
                text: "FristPilot liest das Dokument, erkennt Fristen und erklärt den Inhalt auf verständlichem Deutsch.",
              },
              {
                step: "3",
                title: "Frist nicht vergessen",
                text: "Erkannte Fristen als Erinnerung speichern. Du siehst alles übersichtlich im Dashboard.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="mb-4 text-center text-3xl font-bold text-ink">
          Für wen ist FristPilot?
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-ink-soft">
          Für alle, die wichtige Post erhalten — und keine Zeit haben, jedes
          Dokument selbst zu durchsuchen.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            "Versicherungspost und Vertragskündigungen",
            "Mahnungen und Zahlungsfristen",
            "Behördenbriefe und Widerspruchsfristen",
            "Mietverträge und Nebenkostenabrechnungen",
            "Arztbriefe und Krankenkassenanfragen",
            "Steuerunterlagen und Abgabefristen",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-ink">
              <svg className="h-4 w-4 shrink-0 text-navy" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-center text-white">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="text-3xl font-bold">Nie wieder eine Frist verpassen.</h2>
          <p className="mt-4 text-navy-light opacity-80">
            Kostenlos testen. Kein Abo. Kein Risiko.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center rounded-lg bg-white px-8 py-3 text-base font-semibold text-navy transition-colors hover:bg-gray-50"
          >
            Jetzt starten — kostenlos
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-soft">
          <span>© 2025 FristPilot</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Datenschutz</Link>
            <Link href="/imprint" className="hover:underline">Impressum</Link>
            <Link href="/pricing" className="hover:underline">Preise</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
