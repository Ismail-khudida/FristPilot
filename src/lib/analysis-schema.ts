import { z } from "zod";

// Single Source of Truth für die Struktur der KI-Analyse.
// Das Schema ist bewusst tolerant: Jedes Feld hat einen Fallback, damit eine
// fehlerhafte oder unvollständige KI-Antwort nicht die ganze Analyse zerstört.

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// Deutsche Fristtypen. "sonstige" als sicherer Fallback, falls die KI keinen
// eindeutigen Typ erkennt.
export const DEADLINE_TYPES = [
  "zahlungsfrist",
  "kuendigungsfrist",
  "widerspruchsfrist",
  "nachreichfrist",
  "termin",
  "vertragsverlaengerung",
  "sonstige",
] as const;
export type DeadlineType = (typeof DEADLINE_TYPES)[number];

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  zahlungsfrist: "Zahlungsfrist",
  kuendigungsfrist: "Kündigungsfrist",
  widerspruchsfrist: "Widerspruchsfrist",
  nachreichfrist: "Nachreichfrist",
  termin: "Termin",
  vertragsverlaengerung: "Vertragsverlängerung",
  sonstige: "Frist",
};

// Lebensbereiche für das Dokumentenarchiv. "sonstiges" als Fallback.
export const DOC_CATEGORIES = [
  "behoerde",
  "versicherung",
  "gesundheit",
  "vertrag",
  "rechnung",
  "mahnung",
  "finanzen",
  "wohnen",
  "arbeit",
  "familie",
  "sonstiges",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  behoerde: "Behörde",
  versicherung: "Versicherung",
  gesundheit: "Gesundheit",
  vertrag: "Vertrag",
  rechnung: "Rechnung",
  mahnung: "Mahnung",
  finanzen: "Finanzen",
  wohnen: "Wohnen",
  arbeit: "Arbeit",
  familie: "Familie",
  sonstiges: "Sonstiges",
};

export const COST_INTERVALS = [
  "monatlich",
  "vierteljaehrlich",
  "halbjaehrlich",
  "jaehrlich",
  "einmalig",
  "unbekannt",
] as const;
export type CostInterval = (typeof COST_INTERVALS)[number];

export const COST_INTERVAL_LABELS: Record<CostInterval, string> = {
  monatlich: "monatlich",
  vierteljaehrlich: "vierteljährlich",
  halbjaehrlich: "halbjährlich",
  jaehrlich: "jährlich",
  einmalig: "einmalig",
  unbekannt: "Intervall unbekannt",
};

// Leerer String oder fehlender Wert -> null.
const nullableDate = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().nullable(),
  )
  .catch(null);

// Nur positive Ganzzahlen, sonst null (Seitennummer unbekannt).
const nullablePageNumber = z
  .preprocess((v) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, z.number().int().positive().nullable())
  .catch(null);

// Confidence immer auf 0.0–1.0 begrenzen.
const confidence = z
  .preprocess((v) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  }, z.number())
  .catch(0);

const safeString = (fallback: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v : v == null ? fallback : String(v)),
    z.string(),
  );

export const DeadlineSchema = z.object({
  date: nullableDate,
  deadline_type: z.enum(DEADLINE_TYPES).catch("sonstige"),
  description: safeString("").catch(""),
  required_action: safeString("").catch(""),
  confidence,
  evidence_text: safeString("").catch(""),
  page_number: nullablePageNumber,
});

export type Deadline = z.infer<typeof DeadlineSchema>;

// Betrag tolerant parsen (Komma als Dezimaltrenner, sonst null).
const nullableAmount = z
  .preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, z.number().nullable())
  .catch(null);

// Vertrags-/Verpflichtungsdaten, falls das Dokument ein laufendes
// Vertragsverhältnis beschreibt (Vertrag, Versicherung, Abo). Sonst null.
export const ContractSchema = z.object({
  provider: safeString("").catch(""),
  contract_name: safeString("").catch(""),
  cost_amount: nullableAmount,
  cost_interval: z.enum(COST_INTERVALS).catch("unbekannt"),
  end_date: nullableDate,
  cancel_deadline: nullableDate,
  auto_renewal: z
    .preprocess((v) => v === true || v === "true", z.boolean())
    .catch(false),
});

export type ContractInfo = z.infer<typeof ContractSchema>;

const DEFAULT_DEADLINE: Deadline = {
  date: null,
  deadline_type: "sonstige",
  description: "",
  required_action: "",
  confidence: 0,
  evidence_text: "",
  page_number: null,
};

export const AnalysisSchema = z.object({
  document_type: safeString("Sonstiges").catch("Sonstiges"),
  category: z.enum(DOC_CATEGORIES).catch("sonstiges"),
  sender: safeString("Unbekannt").catch("Unbekannt"),
  // Kurzer, sprechender Anzeigename (statt "image.jpg").
  suggested_title: safeString("").catch(""),
  summary_simple: safeString("").catch(""),
  contract: z
    .preprocess(
      (v) => (v && typeof v === "object" ? v : null),
      ContractSchema.nullable(),
    )
    .catch(null),
  deadlines: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(DeadlineSchema.catch(DEFAULT_DEADLINE)),
  ),
  recommended_actions: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map((a) => (typeof a === "string" ? a : String(a))).filter(Boolean)
        : [],
    z.array(z.string()),
  ),
  risk_level: z.enum(RISK_LEVELS).catch("medium"),
  confidence,
  // Optionaler Rohtext (best effort) – nicht Teil der Kernstruktur, dient nur
  // dem Befüllen der Datenbankspalte `extracted_text`.
  extracted_text: safeString("").optional(),
});

export type DocumentAnalysis = z.infer<typeof AnalysisSchema>;

// Sicherer Standardwert, falls die KI-Antwort gar nicht verwertbar ist.
export const FALLBACK_ANALYSIS: DocumentAnalysis = {
  document_type: "Sonstiges",
  category: "sonstiges",
  sender: "Unbekannt",
  suggested_title: "",
  summary_simple:
    "Dieses Dokument konnte nicht automatisch ausgewertet werden. Bitte prüfe es selbst.",
  contract: null,
  deadlines: [],
  recommended_actions: [],
  risk_level: "medium",
  confidence: 0,
};

// Ein Dokument plus die Bild-Indizes (1-basiert), aus denen es besteht.
// Wird verwendet, wenn mehrere hochgeladene Bilder in mehrere Dokumente
// aufgeteilt werden sollen.
export const DocumentWithPagesSchema = AnalysisSchema.extend({
  page_indices: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v
            .map((n) => (typeof n === "number" ? n : Number(n)))
            .filter((n) => Number.isInteger(n) && n > 0)
        : [],
    z.array(z.number().int().positive()),
  ),
});

export type DocumentWithPages = z.infer<typeof DocumentWithPagesSchema>;

export const MultiDocumentSchema = z.object({
  documents: z.array(DocumentWithPagesSchema),
});

export type ParseMultiResult =
  | { success: true; documents: DocumentWithPages[] }
  | { success: false; error: string };

// Robust ein JSON-Objekt {documents:[...]} extrahieren und validieren.
export function parseMultiAnalysisResult(raw: string): ParseMultiResult {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    return { success: false, error: "Die Antwort war kein gültiges JSON." };
  }
  const result = MultiDocumentSchema.safeParse(candidate);
  if (!result.success || result.data.documents.length === 0) {
    return { success: false, error: "Die Antwort entsprach nicht dem erwarteten Format." };
  }
  return { success: true, documents: result.data.documents };
}

export type ParseAnalysisResult =
  | { success: true; data: DocumentAnalysis }
  | { success: false; error: string };

// Extrahiert robust ein JSON-Objekt aus der Modellantwort und validiert es.
// Liefert ein diskriminiertes Ergebnis, damit der Aufrufer einen echten
// Fehler (-> status "failed") von einer gültigen Analyse unterscheiden kann.
// Es wird NICHT still ein Fallback als Erfolg ausgegeben.
export function parseAnalysisResult(raw: string): ParseAnalysisResult {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    return { success: false, error: "Die KI-Antwort war kein gültiges JSON." };
  }

  const result = AnalysisSchema.safeParse(candidate);
  if (!result.success) {
    return {
      success: false,
      error: "Die KI-Antwort entsprach nicht dem erwarteten Format.",
    };
  }
  return { success: true, data: result.data };
}
