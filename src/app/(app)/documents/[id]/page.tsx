import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { RiskBadge } from "@/components/RiskBadge";
import { CreateReminderButton } from "@/components/CreateReminderButton";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const doc = data as DocumentRow;
  const analysis = doc.analysis_json;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-navy underline">
          ← Zurück zum Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{doc.file_name}</h1>
        <p className="mt-1 text-xs text-ink-soft">
          Hochgeladen am {formatDateTime(doc.created_at)}
        </p>
      </div>

      {doc.status === "processing" ? (
        <div className="card">
          <p className="text-sm font-medium text-ink">Analyse läuft noch …</p>
          <p className="mt-1 text-sm text-ink-soft">
            Dein Dokument wird gerade ausgewertet. Bitte lade die Seite in einem
            Moment neu.
          </p>
        </div>
      ) : doc.status === "failed" || !analysis ? (
        <div className="card border-l-4 border-l-accent">
          <p className="text-sm font-semibold text-ink">Analyse fehlgeschlagen</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {doc.analysis_error ??
              "Dieses Dokument konnte nicht automatisch ausgewertet werden."}{" "}
            Bitte prüfe das Dokument selbst oder lade es erneut hoch.
          </p>
        </div>
      ) : (
        <>
          {/* Übersicht */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-navy/10 px-3 py-1 text-xs font-medium text-navy">
                  {analysis.document_type}
                </span>
                <RiskBadge risk={analysis.risk_level} />
              </div>
              <span className="text-xs text-ink-soft">
                Sicherheit der Analyse:{" "}
                {Math.round((analysis.confidence ?? 0) * 100)}%
              </span>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink-soft">Absender</h2>
              <p className="text-ink">{analysis.sender || "Unbekannt"}</p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink-soft">
                Einfache Zusammenfassung
              </h2>
              <p className="leading-relaxed text-ink">
                {analysis.summary_simple || "Keine Zusammenfassung verfügbar."}
              </p>
            </div>
          </div>

          {/* Mögliche Fristen */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">
              Mögliche Fristen
            </h2>
            {analysis.deadlines.length === 0 ? (
              <div className="card">
                <p className="text-sm text-ink-soft">
                  In diesem Dokument wurde keine mögliche Frist erkannt. Bitte
                  prüfe das Dokument trotzdem selbst.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {analysis.deadlines.map((deadline, i) => (
                  <div key={i} className="card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                        Mögliche Frist erkannt
                      </span>
                      <span className="text-xs text-ink-soft">
                        Confidence: {Math.round((deadline.confidence ?? 0) * 100)}%
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Datum
                      </p>
                      <p className="text-base font-semibold text-ink">
                        {formatDate(deadline.date)}
                      </p>
                      {deadline.date && (
                        <p className="mt-1 text-sm text-ink-soft">
                          Wahrscheinlich ist bis zum {formatDate(deadline.date)}{" "}
                          eine Reaktion erforderlich.
                        </p>
                      )}
                    </div>

                    {deadline.description && (
                      <p className="text-sm text-ink">{deadline.description}</p>
                    )}

                    {deadline.required_action && (
                      <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft">
                        <span className="font-medium text-ink">
                          Wahrscheinlich zu tun:{" "}
                        </span>
                        {deadline.required_action}
                      </p>
                    )}

                    {/* Nachvollziehbarkeit: Grundlage (Evidence) + Seite */}
                    {deadline.evidence_text && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          Grundlage im Dokument
                        </p>
                        <blockquote className="mt-1 border-l-2 border-navy/30 pl-3 text-sm italic text-ink-soft">
                          „{deadline.evidence_text}“
                        </blockquote>
                      </div>
                    )}

                    {deadline.page_number != null && (
                      <p className="text-xs text-ink-soft">
                        Gefunden auf Seite {deadline.page_number}
                      </p>
                    )}

                    <CreateReminderButton
                      documentId={doc.id}
                      defaultTitle={
                        deadline.required_action ||
                        deadline.description ||
                        `Mögliche Frist: ${doc.file_name}`
                      }
                      defaultDescription={deadline.description}
                      defaultDueDate={deadline.date}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Empfohlene Aktionen */}
          {analysis.recommended_actions.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">
                Empfohlene nächste Schritte
              </h2>
              <ul className="card space-y-2">
                {analysis.recommended_actions.map((action, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-navy">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <PrivacyNotice />
      <LegalDisclaimer />

      {/* Dokument vollständig löschen */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">
          Dokument verwalten
        </h2>
        <p className="mb-3 text-xs text-ink-soft">
          Beim Löschen werden die Datei, die Analyse und alle verknüpften
          Erinnerungen unwiderruflich entfernt.
        </p>
        <DeleteDocumentButton documentId={doc.id} />
      </div>
    </div>
  );
}
