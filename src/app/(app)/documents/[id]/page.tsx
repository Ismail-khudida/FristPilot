import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { RiskBadge } from "@/components/RiskBadge";
import { CreateReminderButton } from "@/components/CreateReminderButton";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { ProcessingPoller } from "@/components/ProcessingPoller";
import { AnalysisFeedback } from "@/components/AnalysisFeedback";
import { formatDate, formatDateTime, daysUntil } from "@/lib/format";
import {
  DEADLINE_TYPE_LABELS,
  DOC_CATEGORY_LABELS,
  COST_INTERVAL_LABELS,
  type DocCategory,
} from "@/lib/analysis-schema";
import type { DocumentRow } from "@/lib/types";

// Verständliche Erkennungssicherheit in Worten – ohne prominente Prozentzahl.
function ConfidenceLabel({ value }: { value: number | null | undefined }) {
  const pct = Math.round((value ?? 0) * 100);
  if (pct >= 80)
    return <span className="text-xs font-medium text-green-700">Erkennung: sicher</span>;
  if (pct >= 50)
    return <span className="text-xs font-medium text-amber-700">Erkennung: unsicher</span>;
  return <span className="text-xs font-medium text-red-700">Bitte prüfen</span>;
}

function DeadlineUrgency({ date }: { date: string | null }) {
  if (!date) return null;
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <span className="text-base">🚨</span>
      <span className="text-sm font-semibold text-red-700">Überfällig seit {Math.abs(days)} Tag(en)</span>
    </div>
  );
  if (days === 0) return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <span className="text-base">⚠️</span>
      <span className="text-sm font-semibold text-red-700">Heute fällig!</span>
    </div>
  );
  if (days <= 7) return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <span className="text-base">⏰</span>
      <span className="text-sm font-semibold text-amber-700">Frist in {days} Tag{days === 1 ? "" : "en"}</span>
    </div>
  );
  if (days <= 30) return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
      <span className="text-base">🗓️</span>
      <span className="text-sm text-blue-700">Frist in {days} Tagen</span>
    </div>
  );
  return null;
}

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

  // Bereits vorhandene Erinnerungen dieses Dokuments (für Auto-Erinnerung):
  // Fristen, zu denen schon eine Erinnerung existiert, zeigen einen Status
  // statt des Buttons – so entstehen keine Doppel-Einträge.
  const { data: reminderRows } = await supabase
    .from("reminders")
    .select("due_date")
    .eq("document_id", doc.id);
  const remindedDates = new Set(
    (reminderRows ?? [])
      .map((r) => (r as { due_date: string | null }).due_date)
      .filter((d): d is string => Boolean(d)),
  );

  // Falls die Originalseiten (Opt-in) behalten wurden: kurzlebige Anzeige-Links
  // für ALLE Seiten holen, in Reihenfolge. Backward-compatible: ältere
  // Dokumente haben nur file_url (eine Seite) und kein file_urls.
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "documents";
  const storedPaths: string[] =
    doc.file_urls && doc.file_urls.length > 0
      ? doc.file_urls
      : doc.file_url
        ? [doc.file_url]
        : [];
  const pages: { url: string; isPdf: boolean }[] = [];
  for (const path of storedPaths) {
    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 600);
    if (signed?.signedUrl) {
      pages.push({
        url: signed.signedUrl,
        isPdf: path.toLowerCase().endsWith(".pdf"),
      });
    }
  }
  const imagePages = pages.filter((p) => !p.isPdf);
  const pdfPage = pages.find((p) => p.isPdf);

  const categoryLabel =
    analysis?.category && analysis.category in DOC_CATEGORY_LABELS
      ? DOC_CATEGORY_LABELS[analysis.category as DocCategory]
      : null;

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
          <ProcessingPoller documentId={doc.id} />
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            <p className="text-sm font-medium text-ink">Analyse läuft…</p>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Dein Dokument wird gerade ausgewertet. Das dauert normalerweise
            10–30 Sekunden. Diese Seite aktualisiert sich automatisch.
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
                {categoryLabel && categoryLabel !== analysis.document_type && (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-surface-muted px-3 py-1 text-xs font-medium text-ink-soft">
                    {categoryLabel}
                  </span>
                )}
                <RiskBadge risk={analysis.risk_level} />
              </div>
              <ConfidenceLabel value={analysis.confidence} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink-soft">Absender</h2>
              <p className="text-ink">{analysis.sender || "Unbekannt"}</p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink-soft">
                Was steht in diesem Dokument?
              </h2>
              <p className="leading-relaxed text-ink">
                {analysis.summary_simple || "Keine Zusammenfassung verfügbar."}
              </p>
            </div>

            {doc.page_count > 1 && (
              <p className="text-xs text-ink-soft">
                Dieses Dokument hat {doc.page_count} Seiten.
              </p>
            )}

            {pdfPage && (
              <p className="text-sm">
                <a
                  href={pdfPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy underline"
                >
                  Original-PDF ansehen
                </a>{" "}
                <span className="text-xs text-ink-soft">(Link 10 Minuten gültig)</span>
              </p>
            )}
          </div>

          {/* Erkannter Vertrag */}
          {analysis.contract && (
            <div className="card space-y-3 border-l-4 border-l-navy">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  📑 Laufender Vertrag erkannt
                </h2>
                {analysis.contract.auto_renewal && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    ⚠️ Verlängert sich automatisch
                  </span>
                )}
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {(analysis.contract.provider || analysis.contract.contract_name) && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Vertrag
                    </dt>
                    <dd className="text-ink">
                      {[analysis.contract.provider, analysis.contract.contract_name]
                        .filter(Boolean)
                        .join(" – ")}
                    </dd>
                  </div>
                )}
                {analysis.contract.cost_amount != null && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Kosten
                    </dt>
                    <dd className="text-ink">
                      {new Intl.NumberFormat("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      }).format(analysis.contract.cost_amount)}{" "}
                      {analysis.contract.cost_interval !== "unbekannt" &&
                        COST_INTERVAL_LABELS[analysis.contract.cost_interval]}
                    </dd>
                  </div>
                )}
                {analysis.contract.end_date && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Laufzeit bis
                    </dt>
                    <dd className="text-ink">{formatDate(analysis.contract.end_date)}</dd>
                  </div>
                )}
                {analysis.contract.cancel_deadline && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Kündbar bis
                    </dt>
                    <dd className="font-medium text-ink">
                      {formatDate(analysis.contract.cancel_deadline)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-ink-soft">
                Alle Verträge findest du gesammelt unter{" "}
                <Link href="/contracts" className="text-navy underline">
                  Verträge & Versicherungen
                </Link>
                .
              </p>
            </div>
          )}

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
                    {/* Urgency Banner */}
                    <DeadlineUrgency date={deadline.date} />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                        Mögliche {DEADLINE_TYPE_LABELS[deadline.deadline_type] ?? "Frist"} erkannt
                      </span>
                      <ConfidenceLabel value={deadline.confidence} />
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

                    {deadline.evidence_text && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          Grundlage im Dokument
                        </p>
                        <blockquote className="mt-1 border-l-2 border-navy/30 pl-3 text-sm italic text-ink-soft">
                          „{deadline.evidence_text}"
                        </blockquote>
                      </div>
                    )}

                    {deadline.page_number != null && (
                      <p className="text-xs text-ink-soft">
                        Gefunden auf Seite {deadline.page_number}
                      </p>
                    )}

                    {deadline.date && remindedDates.has(deadline.date) ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                        ✓ Als Erinnerung gespeichert
                        <span className="text-xs font-normal text-ink-soft">
                          (unter „Erinnerungen“ änderbar)
                        </span>
                      </p>
                    ) : (
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
                    )}
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

          {/* Feedback */}
          <div className="rounded-xl border border-gray-200 bg-surface-muted p-4">
            <AnalysisFeedback documentId={doc.id} />
          </div>
        </>
      )}

      {/* Originalseiten (nur wenn "Original behalten" gewählt und Bilder).
          Vertikale Galerie in Reihenfolge, jede Seite klar beschriftet. */}
      {imagePages.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            {imagePages.length === 1 ? "Originaldokument" : "Alle Seiten"}
          </h2>
          <div className="space-y-4">
            {imagePages.map((page, i) => (
              <figure key={i} className="card space-y-2">
                <figcaption className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Seite {i + 1}
                  {imagePages.length > 1 ? ` von ${imagePages.length}` : ""}
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.url}
                  alt={`Seite ${i + 1} von ${doc.file_name}`}
                  className="w-full rounded-lg border border-gray-200"
                />
              </figure>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Anzeige-Links sind aus Sicherheitsgründen nur 10 Minuten gültig.
          </p>
        </section>
      )}

      <PrivacyNotice />
      <LegalDisclaimer />

      {/* Dokument löschen */}
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
