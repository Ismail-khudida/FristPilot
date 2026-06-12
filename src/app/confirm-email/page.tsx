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

        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link href="/login" className="font-medium text-navy underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  );
}
