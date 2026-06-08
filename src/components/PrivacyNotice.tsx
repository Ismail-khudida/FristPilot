import Link from "next/link";

/**
 * Kurzhinweis zur KI-Datenübermittlung.
 * Erscheint auf der Upload-Seite, im ConsentGate und auf der Dokument-Detailseite.
 */
export function PrivacyNotice() {
  return (
    <p className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-soft">
      Dokumente werden zur Analyse an einen KI-Dienstleister übermittelt.
      Bitte laden Sie keine Dokumente hoch, deren Verarbeitung Sie nicht
      wünschen. Weitere Informationen finden Sie in unserer{" "}
      <Link href="/privacy" className="underline hover:text-ink">
        Datenschutzerklärung
      </Link>
      .
    </p>
  );
}

export default PrivacyNotice;
