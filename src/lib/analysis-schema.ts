import { z } from "zod";

// Single Source of Truth für die Struktur der KI-Analyse.
// Das Schema ist bewusst tolerant: Jedes Feld hat einen Fallback, damit eine
// fehlerhafte oder unvollständige KI-Antwort nicht die ganze Analyse zerstört.

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

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
  description: safeString("").catch(""),
  required_action: safeString("").catch(""),
  confidence,
  evidence_text: safeString("").catch(""),
  page_number: nullablePageNumber,
});

export type Deadline = z.infer<typeof DeadlineSchema>;

const DEFAULT_DEADLINE: Deadline = {
  date: null,
  description: "",
  required_action: "",
  confidence: 0,
  evidence_text: "",
  page_number: null,
};

export const AnalysisSchema = z.object({
  document_type: safeString("Sonstiges").catch("Sonstiges"),
  sender: safeString("Unbekannt").catch("Unbekannt"),
  summary_simple: safeString("").catch(""),
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
  sender: "Unbekannt",
  summary_simple:
    "Dieses Dokument konnte nicht automatisch ausgewertet werden. Bitte prüfe es selbst.",
  deadlines: [],
  recommended_actions: [],
  risk_level: "medium",
  confidence: 0,
};

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
