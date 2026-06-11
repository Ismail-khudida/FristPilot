import Anthropic from "@anthropic-ai/sdk";
import {
  parseAnalysisResult,
  parseMultiAnalysisResult,
  type DocumentAnalysis,
} from "./analysis-schema";

// Modellname ausschließlich über Environment Variable, mit sinnvollem Fallback.
// Sonnet ist für OCR + Fristen-Extraktion praktisch gleichwertig zu Opus,
// aber deutlich günstiger – das erlaubt höhere Limits bei besserer Marge.
// Über ANTHROPIC_MODEL jederzeit überschreibbar (z. B. claude-opus-4-8).
const DEFAULT_MODEL = "claude-sonnet-4-6";

function resolveModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODEL;
}

// Erlaubte Upload-Typen und die zugehörigen Claude-Content-Blöcke.
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class AnalysisConfigError extends Error {}
export class AnalysisParseError extends Error {}

// Gemeinsame Beschreibung der Analyse-Felder (ohne page_indices und ohne
// extracted_text – Rohtext wird bewusst nicht gespeichert).
const FIELDS = `  "suggested_title": "Kurzer, sprechender Name des Dokuments – Absender + Art, z. B. 'EUROPA Versicherung – Beitragsinformation', 'Landkreis Schaumburg – Bußgeldstelle', 'Telekom – Rechnung Juni 2026'. Max. 6 Wörter.",
  "document_type": "Versicherung | Behörde | Vertrag | Rechnung | Sonstiges",
  "category": "behoerde | versicherung | gesundheit | vertrag | rechnung | mahnung | finanzen | wohnen | arbeit | familie | sonstiges",
  "sender": "Name des Absenders (oder 'Unbekannt')",
  "summary_simple": "SEHR KURZ: höchstens 3 kurze Sätze in einfacher Alltagssprache. Nur das Wichtigste und was zu tun ist. KEINE Wiederholung des ganzen Briefs, keine juristischen Erklärungen.",
  "contract": {
    "provider": "Anbieter/Gesellschaft (z. B. 'Allianz', 'Vodafone')",
    "contract_name": "Kurzname des Vertrags (z. B. 'Kfz-Haftpflicht', 'DSL-Tarif')",
    "cost_amount": 0.0,
    "cost_interval": "monatlich | vierteljaehrlich | halbjaehrlich | jaehrlich | einmalig | unbekannt",
    "end_date": "YYYY-MM-DD oder null",
    "cancel_deadline": "YYYY-MM-DD oder null (letzter Kündigungstermin)",
    "auto_renewal": false
  },
  "deadlines": [
    {
      "date": "YYYY-MM-DD oder null, falls kein konkretes Datum erkennbar",
      "deadline_type": "zahlungsfrist | kuendigungsfrist | widerspruchsfrist | nachreichfrist | termin | vertragsverlaengerung | sonstige",
      "description": "Was passiert an diesem Datum?",
      "required_action": "Was muss der Nutzer wahrscheinlich tun?",
      "confidence": 0.0,
      "evidence_text": "Die wörtliche Textstelle, auf der diese Frist beruht",
      "page_number": 1
    }
  ],
  "recommended_actions": ["Konkreter nächster Schritt", "..."],
  "risk_level": "low | medium | high",
  "confidence": 0.0`;

const RULES = `Regeln:
- Antworte auf Deutsch.
- "suggested_title": immer ausfüllen, kurz und verständlich (Absender + Art). Nie Dateinamen wie "image.jpg".
- "summary_simple": MAXIMAL 3 kurze Sätze. Beispiel-Stil: "Deine Versicherung informiert dich über eine Änderung. Es gibt eine mögliche Frist bis zum 14.07. Bitte prüfe, ob du reagieren musst." Kein langer Text.
- "category": genau ein Lebensbereich. mahnung nur bei echten Mahnungen; gesundheit für Arzt/Krankenkasse; wohnen für Miete/Nebenkosten/Strom/Gas; finanzen für Bank/Steuer/Finanzamt; familie für Kita/Schule/Unterhalt. Im Zweifel "sonstiges".
- "contract": NUR bei laufendem Vertragsverhältnis (Versicherung, Abo, Miet-/Mobilfunk-/Energievertrag) – sonst null. Beträge als Zahl. Nichts erfinden.
- Erfinde keine Fristen. Keine Frist erkennbar -> leeres Array.
- "deadline_type": zahlungsfrist = zu zahlen; kuendigungsfrist = letzter Kündigungstermin; widerspruchsfrist = Widerspruch/Einspruch; nachreichfrist = Unterlagen einreichen; termin = fester Termin; vertragsverlaengerung = automatische Verlängerung; sonstige = nichts davon.
- "evidence_text": möglichst wörtlich zitieren; sonst leer lassen.
- "page_number": Seite/Bild der Fundstelle (1-basiert). Nicht bestimmbar -> null.
- "confidence" (pro Frist und gesamt): 0.0–1.0, wie sicher du dir bist. Im Zweifel niedrig.
- "risk_level": high = wichtige Frist mit rechtlichen/finanziellen Folgen, medium = relevant aber unkritisch, low = informativ.`;

const GRUNDHALTUNG = `Du bist FristPilot, ein Assistent, der deutschsprachigen Nutzern hilft, MÖGLICHE Fristen und Handlungspflichten aus Dokumenten zu erkennen (Briefe, Behördenpost, Rechnungen, Verträge, Versicherungen).

Wichtige Grundhaltung:
- Stelle Fristen niemals als sichere Fakten dar. Es sind immer MÖGLICHE Fristen.
- Du gibst keine Rechtsberatung und suggerierst keine absolute Sicherheit.
- Formuliere vorsichtig ("wahrscheinlich", "möglicherweise") statt absolut.`;

// Prompt für genau EIN Dokument (einzelnes Bild oder mehrseitiges PDF).
const SINGLE_SYSTEM_PROMPT = `${GRUNDHALTUNG}

Ein Dokument kann aus mehreren Seiten bestehen (mehrseitiges PDF). Betrachte alle Seiten gemeinsam.

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück – kein einleitender Text, keine Markdown-Codeblöcke. Struktur:
{
${FIELDS}
}

${RULES}`;

// Prompt für MEHRERE Bilder, die zu einem ODER mehreren Dokumenten gehören
// können. Claude entscheidet die Gruppierung und analysiert jede Gruppe.
const MULTI_SYSTEM_PROMPT = `${GRUNDHALTUNG}

Der Nutzer hat MEHRERE Bilder hochgeladen. Diese können:
(a) zusammen EIN mehrseitiges Dokument sein, ODER
(b) VERSCHIEDENE, voneinander unabhängige Dokumente/Briefe sein.

Entscheide ZUERST, welche Bilder zum selben Dokument gehören. Stütze dich auf: Absender, Aktenzeichen/Kundennummer, Layout/Briefkopf, Datum, Betreff, Dokumenttyp und fortlaufenden Inhalt (z. B. "Seite 2 von 2"). Wirf NICHT einfach alles zusammen: Wenn zwei Bilder klar von verschiedenen Absendern oder unterschiedlichen Vorgängen stammen, sind es VERSCHIEDENE Dokumente.

Gib dann AUSSCHLIESSLICH ein JSON-Objekt zurück – kein einleitender Text, keine Markdown-Codeblöcke. Struktur:
{
  "documents": [
    {
      "page_indices": [1, 2],
${FIELDS}
    }
  ]
}

"page_indices": die Nummern der Bilder (1-basiert, in Reihenfolge), die zu diesem Dokument gehören. Jedes Bild gehört zu GENAU EINEM Dokument; alle Bilder müssen zugeordnet sein.

${RULES}`;

export interface AnalyzeInput {
  data: Buffer;
  mimeType: string;
}

function buildContentBlock(
  base64: string,
  mimeType: string,
): Anthropic.ContentBlockParam {
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mimeType as "image/jpeg" | "image/png",
      data: base64,
    },
  };
}

/** Ein erkanntes Dokument samt der (1-basierten) Bild-Indizes, aus denen es besteht. */
export interface AnalyzedDocument {
  pageIndices: number[];
  analysis: DocumentAnalysis;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AnalysisConfigError("ANTHROPIC_API_KEY ist nicht gesetzt.");
  return new Anthropic({ apiKey });
}

// Eine einzelne Seite (Bild) oder ein PDF -> genau ein Dokument.
async function analyzeSingle(page: AnalyzeInput): Promise<DocumentAnalysis> {
  const client = getClient();
  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 3000,
    system: SINGLE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(page.data.toString("base64"), page.mimeType),
          { type: "text", text: "Analysiere dieses Dokument und gib nur das JSON-Objekt zurück." },
        ],
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AnalysisParseError("Die Analyse lieferte keine verwertbare Antwort.");
  }
  const result = parseAnalysisResult(textBlock.text);
  if (!result.success) throw new AnalysisParseError(result.error);
  return result.data;
}

// Sorgt dafür, dass jede Bildnummer 1..N genau einem Dokument zugeordnet ist.
// Ungültige/fehlende Zuordnungen werden bereinigt, nicht zugeordnete Bilder
// kommen als eigenes Dokument ans Ende.
function normalizeGroups(
  docs: { page_indices: number[]; analysis: DocumentAnalysis }[],
  pageCount: number,
): AnalyzedDocument[] {
  const seen = new Set<number>();
  const out: AnalyzedDocument[] = [];
  for (const d of docs) {
    const idx = d.page_indices
      .filter((n) => n >= 1 && n <= pageCount && !seen.has(n))
      .sort((a, b) => a - b);
    idx.forEach((n) => seen.add(n));
    if (idx.length > 0) out.push({ pageIndices: idx, analysis: d.analysis });
  }
  // Nicht zugeordnete Bilder einzeln anhängen (mit der jeweils ersten Analyse
  // als grobe Näherung, sonst Fallback-leer wäre schlechter – aber das sollte
  // praktisch nicht vorkommen, da der Prompt vollständige Zuordnung verlangt).
  const leftovers = [];
  for (let n = 1; n <= pageCount; n++) if (!seen.has(n)) leftovers.push(n);
  if (leftovers.length > 0 && out.length > 0) {
    out.push({ pageIndices: leftovers, analysis: out[out.length - 1].analysis });
  }
  return out;
}

// Mehrere Bilder -> ein oder mehrere Dokumente (Gruppierung durch das Modell).
async function analyzeGrouped(pages: AnalyzeInput[]): Promise<AnalyzedDocument[]> {
  const client = getClient();
  const content: Anthropic.ContentBlockParam[] = [];
  pages.forEach((p, i) => {
    content.push({ type: "text", text: `— Bild ${i + 1} von ${pages.length} —` });
    content.push(buildContentBlock(p.data.toString("base64"), p.mimeType));
  });
  content.push({
    type: "text",
    text: "Gruppiere die Bilder in Dokumente und analysiere jedes. Gib nur das JSON-Objekt {\"documents\":[...]} zurück.",
  });

  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 8000,
    system: MULTI_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AnalysisParseError("Die Analyse lieferte keine verwertbare Antwort.");
  }
  const result = parseMultiAnalysisResult(textBlock.text);
  if (!result.success) throw new AnalysisParseError(result.error);

  return normalizeGroups(
    result.documents.map((d) => ({ page_indices: d.page_indices, analysis: d })),
    pages.length,
  );
}

// Öffentliche API: nimmt eine oder mehrere Seiten und liefert ein oder mehrere
// Dokumente zurück. Ein einzelnes Bild oder PDF ergibt immer genau ein
// Dokument; mehrere Bilder werden bei Bedarf in mehrere Dokumente getrennt.
export async function analyzeDocuments(
  pages: AnalyzeInput[],
): Promise<AnalyzedDocument[]> {
  if (pages.length === 0) {
    throw new AnalysisConfigError("Keine Seiten zur Analyse übergeben.");
  }
  if (pages.length === 1) {
    const analysis = await analyzeSingle(pages[0]);
    return [{ pageIndices: [1], analysis }];
  }
  return analyzeGrouped(pages);
}
