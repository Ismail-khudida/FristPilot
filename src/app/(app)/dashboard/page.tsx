import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReminderItem } from "@/components/ReminderItem";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime, daysUntil } from "@/lib/format";
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
      .limit(8),
  ]);

  const openReminders = (reminderData ?? []) as ReminderRow[];
  const documents = (documentData ?? []) as unknown as DocSummary[];

  // Handlungs-Triage: jede offene Erinnerung einer Dringlichkeitsstufe zuordnen.
  const actNow: ReminderRow[] = []; // überfällig oder heute fällig
  const soon: ReminderRow[] = []; // in 1–7 Tagen
  const later: ReminderRow[] = []; // später als 7 Tage
  const toReview: ReminderRow[] = []; // ohne Datum -> unklar/prüfen

  for (const r of openReminders) {
    const days = daysUntil(r.due_date);
    if (days === null) toReview.push(r);
    else if (days <= 0) actNow.push(r);
    else if (days <= 7) soon.push(r);
    else later.push(r);
  }

  // Fehlgeschlagene Analysen brauchen ebenfalls Aufmerksamkeit ("Prüfen").
  const failedDocs = documents.filter((d) => d.status === "failed");

  const isEmpty = documents.length === 0 && openReminders.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dein Bürokratie-Überblick</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Was ist wichtig, was läuft bald ab — und was musst du tun?
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
            <Link href="/demo" className="btn-secondary">
              Erst Beispiel ansehen
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            PDF, JPG oder PNG · kostenlos · max. 10 MB
          </p>
        </div>
      )}

      {/* Sofort handeln */}
      {actNow.length > 0 && (
        <TriageSection
          label={`Sofort handeln (${actNow.length})`}
          tone="critical"
          hint="Überfällig oder heute fällig."
        >
          {actNow.map((r) => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
        </TriageSection>
      )}

      {/* Bald fällig */}
      {soon.length > 0 && (
        <TriageSection
          label={`Bald fällig (${soon.length})`}
          tone="warn"
          hint="In den nächsten 7 Tagen."
        >
          {soon.map((r) => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
        </TriageSection>
      )}

      {/* Prüfen */}
      {(toReview.length > 0 || failedDocs.length > 0) && (
        <TriageSection
          label={`Prüfen (${toReview.length + failedDocs.length})`}
          tone="neutral"
          hint="Ohne festes Datum oder Analyse fehlgeschlagen — bitte selbst ansehen."
        >
          {toReview.map((r) => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
          {failedDocs.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="card flex items-center justify-between gap-3 transition-colors hover:border-navy/40"
            >
              <span className="truncate font-medium text-ink">{doc.file_name}</span>
              <span className="inline-flex shrink-0 items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                Analyse fehlgeschlagen
              </span>
            </Link>
          ))}
        </TriageSection>
      )}

      {/* Später */}
      {later.length > 0 && (
        <TriageSection
          label={`Später (${later.length})`}
          tone="calm"
          hint="Mehr als 7 Tage Zeit."
        >
          {later.slice(0, 4).map((r) => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
          {later.length > 4 && (
            <Link href="/reminders" className="text-sm text-navy underline">
              Alle {later.length} ansehen
            </Link>
          )}
        </TriageSection>
      )}

      {/* Keine offenen Fristen, aber Dokumente vorhanden */}
      {!isEmpty && openReminders.length === 0 && failedDocs.length === 0 && (
        <div className="card">
          <p className="text-sm text-ink-soft">
            Aktuell keine offenen Fristen. 🎉 Lade ein Dokument hoch und speichere
            erkannte Fristen als Erinnerung, damit FristPilot dich rechtzeitig
            benachrichtigt.
          </p>
        </div>
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

// Eine Triage-Sektion mit farbiger Akzentlinie je nach Dringlichkeit.
function TriageSection({
  label,
  hint,
  tone,
  children,
}: {
  label: string;
  hint: string;
  tone: "critical" | "warn" | "neutral" | "calm";
  children: React.ReactNode;
}) {
  const dot = {
    critical: "bg-accent",
    warn: "bg-amber-500",
    neutral: "bg-gray-400",
    calm: "bg-blue-400",
  }[tone];

  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
          {label}
        </h2>
        <p className="mt-0.5 pl-4 text-xs text-ink-soft">{hint}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
