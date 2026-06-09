import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReminderItem } from "@/components/ReminderItem";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDate, formatDateTime, dueLabel } from "@/lib/format";
import type { ReminderRow } from "@/lib/types";

interface DocSummary {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  analysis_json: { sender?: string; risk_level?: string } | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: reminderData }, { data: documentData }] = await Promise.all([
    supabase
      .from("reminders")
      .select("*")
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("id, file_name, status, created_at, analysis_json")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const openReminders = (reminderData ?? []) as ReminderRow[];
  const documents = (documentData ?? []) as unknown as DocSummary[];
  const nextAction = openReminders.find((r) => r.due_date) ?? openReminders[0];
  const isEmpty = documents.length === 0 && openReminders.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Dein Überblick über offene Fristen und Dokumente.
          </p>
        </div>
        <Link href="/upload" className="btn-primary">
          Dokument hochladen
        </Link>
      </div>

      {/* Onboarding Empty State */}
      {isEmpty && (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-4xl">📬</div>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Willkommen bei FristPilot!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Lade deinen ersten Brief, eine Rechnung oder ein Behördenschreiben hoch.
            FristPilot erklärt es dir und sucht nach möglichen Fristen.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/upload" className="btn-primary">
              Erstes Dokument hochladen
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            PDF, JPG oder PNG · kostenlos · max. 10 MB
          </p>
        </div>
      )}

      {/* Wichtigste nächste Aktion */}
      {nextAction && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Wichtigste nächste Aktion
          </h2>
          <div className="card border-l-4 border-l-accent">
            <p className="font-semibold text-ink">{nextAction.title}</p>
            {nextAction.description && (
              <p className="mt-1 text-sm text-ink-soft">
                {nextAction.description}
              </p>
            )}
            <p className="mt-2 text-sm">
              <span className="text-ink-soft">
                {formatDate(nextAction.due_date)}
              </span>
              {nextAction.due_date && (
                <span className="ml-2 font-medium text-accent">
                  {dueLabel(nextAction.due_date)}
                </span>
              )}
            </p>
          </div>
        </section>
      )}

      {/* Offene Fristen */}
      {!isEmpty && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Offene Fristen ({openReminders.length})
            </h2>
            {openReminders.length > 0 && (
              <Link href="/reminders" className="text-sm text-navy underline">
                Alle ansehen
              </Link>
            )}
          </div>
          {openReminders.length === 0 ? (
            <div className="card">
              <p className="text-sm text-ink-soft">
                Noch keine Erinnerungen. Lade ein Dokument hoch und speichere
                erkannte Fristen als Erinnerung.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {openReminders.slice(0, 4).map((r) => (
                <ReminderItem key={r.id} reminder={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Zuletzt hochgeladene Dokumente */}
      {documents.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Zuletzt hochgeladene Dokumente
          </h2>
          <div className="space-y-3">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 transition-colors hover:border-navy/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {doc.analysis_json?.sender
                      ? `${doc.analysis_json.sender} · `
                      : ""}
                    {formatDateTime(doc.created_at)}
                  </p>
                </div>
                {doc.status === "processing" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-surface-muted px-3 py-1 text-xs font-medium text-ink-soft">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-navy/40" />
                    Analyse läuft…
                  </span>
                ) : doc.status === "failed" ? (
                  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    Analyse fehlgeschlagen
                  </span>
                ) : (
                  doc.analysis_json && (
                    <RiskBadge risk={doc.analysis_json.risk_level ?? null} />
                  )
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
