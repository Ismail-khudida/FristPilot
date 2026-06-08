// Zentraler Datenschutz-/KI-Hinweis. Erscheint auf der Upload-Seite, der
// Dokument-Detailseite und im Analyse-Ergebnisbereich.
export function PrivacyNotice() {
  return (
    <p className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-soft">
      Die Analyse erfolgt mithilfe künstlicher Intelligenz. Die Ergebnisse
      können Fehler enthalten. Bitte prüfen Sie wichtige Dokumente selbst oder
      wenden Sie sich an eine Fachperson.
    </p>
  );
}

export default PrivacyNotice;
