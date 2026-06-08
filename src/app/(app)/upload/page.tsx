import { UploadForm } from "@/components/UploadForm";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { PrivacyNotice } from "@/components/PrivacyNotice";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dokument hochladen</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Lade einen Brief, eine Rechnung oder ein anderes Dokument hoch.
          FristPilot erklärt es in einfacher Sprache und sucht nach möglichen
          Fristen.
        </p>
      </div>

      <div className="card">
        <UploadForm />
      </div>

      <PrivacyNotice />
      <LegalDisclaimer />
    </div>
  );
}
