import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime } from "@/lib/format";
import {
  DOC_CATEGORIES,
  DOC_CATEGORY_LABELS,
  type DocCategory,
} from "@/lib/analysis-schema";

interface DocRow {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  category: string | null;
  analysis_json: {
    sender?: string;
    risk_level?: string;
    summary_simple?: string;
  } | null;
}

function isDocCategory(v: string | undefined): v is DocCategory {
  return !!v && (DOC_CATEGORIES as readonly string[]).includes(v);
}

// Dokumentenarchiv: alle Dokumente mit Kategorie-Filter und Suche.
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string }>;
}) {
  const { cat, q } = await searchParams;
  const activeCat = isDocCategory(cat) ? cat : null;
  const query = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  let request = supabase
    .from("documents")
    .select("id, file_name, status, created_at, category, analysis_json")
    .order("created_at", { ascending: false })
    .limit(200);
  if (activeCat) request = request.eq("category", activeCat);

  const { data } = await request;
  let documents = (data ?? []) as unknown as DocRow[];

  // Suche über Dateiname, Absender und Zusammenfassung (clientnah, da die
  // Datenmenge pro Nutzer klein ist; bei Skalierung -> Volltextindex).
  if (query) {
    documents = documents.filter((d) => {
      const hay = [
        d.file_name,
        d.analysis_json?.sender ?? "",
        d.analysis_json?.summary_simple ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }

  // Kategorien mit Belegung zuerst anzeigen wäre nett, aber für Übersicht
  // reichen die festen Chips.
  const buildHref = (c: DocCategory | null) => {
    const params = new URLSearchParams();
    if (c) params.set("cat", c);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/documents?${s}` : "/documents";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dokumente</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Dein Archiv — automatisch nach Lebensbereichen sortiert.
          </p>
        </div>
        <Link href="/upload" className="btn-primary">
          Dokument hochladen
        </Link>
      </div>

      {/* Suche */}
      <form method="GET" action="/documents" className="flex gap-2">
        {activeCat && <input type="hidden" name="cat" value={activeCat} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Suchen nach Absender, Datei oder Inhalt…"
          className="field-input max-w-md"
        />
        <button type="submit" className="btn-secondary">
          Suchen
        </button>
      </form>

      {/* Kategorie-Filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !activeCat
              ? "bg-navy text-white"
              : "border border-gray-200 bg-white text-ink-soft hover:border-navy/40"
          }`}
        >
          Alle
        </Link>
        {DOC_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCat === c
                ? "bg-navy text-white"
                : "border border-gray-200 bg-white text-ink-soft hover:border-navy/40"
            }`}
          >
            {DOC_CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {documents.length === 0 ? (
        <div className="card">
          <p className="text-sm text-ink-soft">
            {query || activeCat
              ? "Keine Dokumente für diese Auswahl gefunden."
              : "Noch keine Dokumente. Lade dein erstes Dokument hoch — FristPilot sortiert es automatisch ein."}
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
                <p className="truncate font-medium text-ink">{doc.file_name}</p>
                <p className="text-xs text-ink-soft">
                  {doc.analysis_json?.sender
                    ? `${doc.analysis_json.sender} · `
                    : ""}
                  {formatDateTime(doc.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isDocCategory(doc.category ?? undefined) && (
                  <span className="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-1 text-xs font-medium text-navy">
                    {DOC_CATEGORY_LABELS[doc.category as DocCategory]}
                  </span>
                )}
                {doc.status === "processing" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-surface-muted px-3 py-1 text-xs font-medium text-ink-soft">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-navy/40" />
                    Analyse läuft…
                  </span>
                ) : doc.status === "failed" ? (
                  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    Fehlgeschlagen
                  </span>
                ) : (
                  doc.analysis_json && (
                    <RiskBadge risk={doc.analysis_json.risk_level ?? null} />
                  )
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
