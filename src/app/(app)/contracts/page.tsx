import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateReminderButton } from "@/components/CreateReminderButton";
import { formatDate, daysUntil } from "@/lib/format";
import {
  COST_INTERVAL_LABELS,
  type ContractInfo,
  type DocumentAnalysis,
} from "@/lib/analysis-schema";

interface DocRow {
  id: string;
  file_name: string;
  created_at: string;
  analysis_json: DocumentAnalysis | null;
}

interface ContractEntry {
  documentId: string;
  fileName: string;
  contract: ContractInfo;
  /** Nächster relevanter Stichtag: Kündigungsfrist oder Laufzeitende. */
  nextDate: string | null;
  daysLeft: number | null;
}

function formatCost(c: ContractInfo): string | null {
  if (c.cost_amount == null) return null;
  const amount = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(c.cost_amount);
  return c.cost_interval === "unbekannt"
    ? amount
    : `${amount} ${COST_INTERVAL_LABELS[c.cost_interval]}`;
}

// Vertragsübersicht: alle Dokumente, in denen die KI ein laufendes
// Vertragsverhältnis erkannt hat (Verträge, Versicherungen, Abos).
export default async function ContractsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, file_name, created_at, analysis_json")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries: ContractEntry[] = [];
  for (const doc of (data ?? []) as unknown as DocRow[]) {
    const contract = doc.analysis_json?.contract;
    if (!contract) continue;
    const nextDate = contract.cancel_deadline ?? contract.end_date ?? null;
    entries.push({
      documentId: doc.id,
      fileName: doc.file_name,
      contract,
      nextDate,
      daysLeft: nextDate ? daysUntil(nextDate) : null,
    });
  }

  // Dringendste zuerst; Einträge ohne Stichtag ans Ende.
  entries.sort((a, b) => {
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  const urgent = entries.filter(
    (e) => e.daysLeft !== null && e.daysLeft <= 60,
  );
  const rest = entries.filter((e) => !urgent.includes(e));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Verträge & Versicherungen
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Automatisch aus deinen Dokumenten erkannt — Laufzeiten,
          Kündigungsfristen und Kosten auf einen Blick.
        </p>
      </div>

      {entries.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-4xl">📑</div>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Noch keine Verträge erkannt
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Lade Vertragsunterlagen, Versicherungspolicen oder Abo-Bestätigungen
            hoch — FristPilot erkennt Anbieter, Kosten, Laufzeit und
            Kündigungsfrist automatisch.
          </p>
          <Link href="/upload" className="btn-primary mt-6 inline-flex">
            Dokument hochladen
          </Link>
        </div>
      )}

      {urgent.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            Bald kündbar oder läuft aus ({urgent.length})
          </h2>
          <div className="space-y-3">
            {urgent.map((e) => (
              <ContractCard key={e.documentId} entry={e} highlight />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Alle Verträge ({rest.length})
          </h2>
          <div className="space-y-3">
            {rest.map((e) => (
              <ContractCard key={e.documentId} entry={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContractCard({
  entry,
  highlight = false,
}: {
  entry: ContractEntry;
  highlight?: boolean;
}) {
  const { contract: c, daysLeft } = entry;
  const cost = formatCost(c);
  const title =
    [c.provider, c.contract_name].filter(Boolean).join(" – ") ||
    entry.fileName;

  return (
    <div className={`card space-y-3 ${highlight ? "border-l-4 border-l-amber-500" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          <Link
            href={`/documents/${entry.documentId}`}
            className="text-xs text-navy underline"
          >
            Zum Dokument
          </Link>
        </div>
        {c.auto_renewal && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            ⚠️ Verlängert sich automatisch
          </span>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {cost && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Kosten
            </dt>
            <dd className="text-ink">{cost}</dd>
          </div>
        )}
        {c.end_date && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Laufzeit bis
            </dt>
            <dd className="text-ink">{formatDate(c.end_date)}</dd>
          </div>
        )}
        {c.cancel_deadline && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Kündbar bis
            </dt>
            <dd className={daysLeft !== null && daysLeft <= 30 ? "font-semibold text-accent" : "text-ink"}>
              {formatDate(c.cancel_deadline)}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="ml-1 text-xs text-ink-soft">
                  (in {daysLeft} Tagen)
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {c.cancel_deadline && (
        <CreateReminderButton
          documentId={entry.documentId}
          defaultTitle={`Kündigungsfrist: ${title}`}
          defaultDescription={
            c.auto_renewal
              ? "Vertrag verlängert sich automatisch, falls nicht gekündigt wird."
              : undefined
          }
          defaultDueDate={c.cancel_deadline}
        />
      )}
    </div>
  );
}
