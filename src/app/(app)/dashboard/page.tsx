import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReminderItem } from "@/components/ReminderItem";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDate, formatDateTime, dueLabel } from "@/lib/format";
import type { DocumentRow, ReminderRow } from "@/lib/types";

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
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const openReminders = (reminderData ?? []) as ReminderRow[];
  const documents = (documentData ?? []) as DocumentRow[];
  const nextAction = openReminders.find((r) => r.due_date) ?? openReminders[0];

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
              Du hast aktuell keine offenen Fristen. Sobald du ein Dokument
              hochlädst und eine Erinnerung speicherst, erscheint sie hier.
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

      {/* Zuletzt hochgeladene Dokumente */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Zuletzt hochgeladene Dokumente
        </h2>
        {documents.length === 0 ? (
          <div className="card">
            <p className="text-sm text-ink-soft">
              Noch keine Dokumente.{" "}
              <Link href="/upload" className="text-navy underline">
                Lade dein erstes Dokument hoch.
              </Link>
            </p>
          </div>
        ) : (
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
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-surface-muted px-3 py-1 text-xs font-medium text-ink-soft">
                    Analyse läuft …
                  </span>
                ) : doc.status === "failed" ? (
                  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    Analyse fehlgeschlagen
                  </span>
                ) : (
                  doc.analysis_json && (
                    <RiskBadge risk={doc.analysis_json.risk_level} />
                  )
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
