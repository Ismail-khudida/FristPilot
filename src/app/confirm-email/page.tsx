import Link from "next/link";
import { ResendConfirmationForm } from "@/components/ResendConfirmationForm";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-2xl font-semibold text-navy">Ordwell</div>
        </div>

        <div className="card space-y-4">
          <h1 className="text-lg font-semibold text-ink">
            Bitte prüfe deine E-Mails
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            Wir haben dir einen Bestätigungslink
            {email ? (
              <>
                {" "}an <span className="font-medium text-ink">{email}</span>
              </>
            ) : null}{" "}
            geschickt. Bitte öffne den Link, um dein Konto zu aktivieren.
          </p>

          <ResendConfirmationForm email={email ?? ""} />
        </div>

        {/* Aha-Moment während der Wartezeit: Beispiel-Analyse ansehen (U2) */}
        <div className="card mt-4 space-y-3 border-l-4 border-l-navy">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👀</span>
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Während du wartest: Schau dir an, was Ordwell kann
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Unser Beispiel zeigt dir, wie ein analysierter Brief aussieht —
                mit erkannter Frist, einfacher Erklärung und Erinnerung. Ganz
                ohne eigenen Upload.
              </p>
            </div>
          </div>
          <Link href="/demo" className="btn-primary w-full text-center">
            Beispiel-Analyse ansehen →
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link href="/login" className="font-medium text-navy underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  );
}
