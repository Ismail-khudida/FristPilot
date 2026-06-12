import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { ConsentGate } from "@/components/ConsentGate";
import { getConsentState } from "./actions";

export default async function UploadPage() {
  const { hasConsent } = await getConsentState();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dokument hochladen</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Lade einen Brief, eine Rechnung oder ein anderes Dokument hoch.
          Ordwell erklärt es in einfacher Sprache und sucht nach möglichen
          Fristen. Das Originaldokument wird nach der Analyse automatisch
          gelöscht.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/demo" className="text-navy underline">
            Erst ein Beispiel ansehen →
          </Link>
        </p>
      </div>

      {/* Vertrauens-Pipeline: Was mit dem Dokument passiert */}
      <div className="rounded-xl border border-gray-200 bg-surface-muted p-5">
        <h2 className="text-sm font-semibold text-ink">
          Was passiert mit deinem Dokument?
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            {
              icon: "🔒",
              title: "Verschlüsselt übertragen",
              text: "Dein Dokument wird sicher hochgeladen.",
            },
            {
              icon: "🤖",
              title: "Ordwell liest & erkennt Fristen",
              text: "Analyse durch Anthropic (transparent ausgewiesen).",
            },
            {
              icon: "📋",
              title: "Nur Ergebnis bleibt",
              text: "Zusammenfassung & Fristen — kein Volltext.",
            },
            {
              icon: "🗑️",
              title: "Original gelöscht",
              text: "Die Datei wird direkt nach der Analyse entfernt.",
            },
          ].map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-2">
                <span className="text-lg">{step.icon}</span>
                <span className="text-xs font-semibold text-navy">
                  Schritt {i + 1}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-ink">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-soft">
          Deine Dokumente werden <strong>nicht</strong> zum Training von KI
          verwendet. Mehr in der{" "}
          <Link href="/privacy" className="text-navy underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </div>

      <ConsentGate initialConsent={hasConsent}>
        <div className="card">
          <UploadForm />
        </div>
        <PrivacyNotice />
      </ConsentGate>

      <LegalDisclaimer />
    </div>
  );
}
