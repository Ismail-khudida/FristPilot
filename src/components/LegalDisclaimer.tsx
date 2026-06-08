// Wiederverwendbarer Haftungshinweis. Überall dort einsetzen, wo
// Analyseergebnisse angezeigt werden.
export function LegalDisclaimer() {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
      Diese Analyse kann Fehler enthalten und ersetzt keine rechtliche Beratung.
      Bitte prüfe wichtige Dokumente selbst oder frage eine Fachperson.
    </p>
  );
}

export default LegalDisclaimer;
