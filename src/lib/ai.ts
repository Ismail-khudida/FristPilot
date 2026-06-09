import Anthropic from "@anthropic-ai/sdk";
import { parseAnalysisResult, type DocumentAnalysis } from "./analysis-schema";

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

// Eigene Fehlerklassen, damit Aufrufer Konfigurations-, Antwort- und
// Validierungsfehler unterscheiden können.
export class AnalysisConfigError extends Error {}
export class AnalysisParseError extends Error {}

const SYSTEM_PROMPT = `Du bist FristPilot, ein Assistent, der deutschsprachigen Nutzern hilft, MÖGLICHE Fristen und Handlungspflichten aus Dokumenten zu erkennen (Briefe, Behördenpost, Rechnungen, Verträge, Versicherungen).

Wichtige Grundhaltung:
- Stelle Fristen niemals als sichere Fakten dar. Es sind immer MÖGLICHE Fristen.
- Du gibst keine Rechtsberatung und suggerierst keine absolute Sicherheit.
- Formuliere vorsichtig ("wahrscheinlich", "möglicherweise") statt absolut.

Analysiere das Dokument und gib AUSSCHLIESSLICH ein JSON-Objekt zurück – kein einleitender Text, keine Erklärungen, keine Markdown-Codeblöcke.

Das JSON-Objekt hat exakt diese Struktur:
{
  "document_type": "Versicherung | Behörde | Vertrag | Rechnung | Sonstiges",
  "sender": "Name des Absenders (oder 'Unbekannt')",
  "summary_simple": "Einfache, beruhigende Erklärung des Dokuments in 2-4 Sätzen, in klarer Alltagssprache, ohne Fachbegriffe",
  "deadlines": [
    {
      "date": "YYYY-MM-DD oder null, falls kein konkretes Datum erkennbar",
      "deadline_type": "zahlungsfrist | kuendigungsfrist | widerspruchsfrist | nachreichfrist | termin | vertragsverlaengerung | sonstige",
      "description": "Was passiert an diesem Datum?",
      "required_action": "Was muss der Nutzer wahrscheinlich tun?",
      "confidence": 0.0,
      "evidence_text": "Die wörtliche Textstelle aus dem Dokument, auf der diese Frist beruht",
      "page_number": 1
    }
  ],
  "recommended_actions": ["Konkreter nächster Schritt", "..."],
  "risk_level": "low | medium | high",
  "confidence": 0.0,
  "extracted_text": "Die wichtigsten Textpassagen des Dokuments als Klartext"
}

Regeln:
- Antworte auf Deutsch.
- Erfinde keine Fristen. Wenn keine Frist erkennbar ist, gib ein leeres Array zurück.
- "evidence_text": Zitiere möglichst wörtlich die Stelle, die zur Frist führt, damit der Nutzer die Aussage nachvollziehen kann. Lass das Feld leer, wenn es keine eindeutige Stelle gibt.
- "deadline_type": Ordne jede Frist einem Typ zu. zahlungsfrist = Rechnung/Mahnung zu zahlen; kuendigungsfrist = letzter Termin zum Kündigen; widerspruchsfrist = Frist für Widerspruch/Einspruch (z. B. Behörde, Bescheid); nachreichfrist = Unterlagen einreichen/nachreichen; termin = fester Termin (z. B. Anhörung); vertragsverlaengerung = automatische Verlängerung droht; sonstige = nichts davon passt. Im Zweifel "sonstige".
- "page_number": Seitenzahl der Fundstelle (1-basiert). Wenn nicht bestimmbar, gib null an – rate nicht.
- "confidence" (pro Frist und gesamt) ist eine Zahl zwischen 0.0 und 1.0 und beschreibt, wie sicher du dir bist.
- "risk_level": high = wichtige mögliche Frist mit potenziellen rechtlichen/finanziellen Folgen, medium = relevant aber unkritisch, low = informativ.
- Sei vorsichtig: Im Zweifel weise auf Unsicherheit hin (niedrige confidence), statt zu raten.`;

interface AnalyzeInput {
  /** Rohdaten der Datei. */
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
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
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

// Schickt das Dokument direkt an Claude. PDFs werden als Dokument-Block,
// Bilder als Bild-Block übergeben – Claude übernimmt Texterkennung (OCR)
// und Analyse in einem Schritt. Das Ergebnis wird per Zod-Schema validiert.
export async function analyzeDocument({
  data,
  mimeType,
}: AnalyzeInput): Promise<DocumentAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalysisConfigError("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const client = new Anthropic({ apiKey });
  const base64 = data.toString("base64");

  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(base64, mimeType),
          {
            type: "text",
            text: "Analysiere dieses Dokument und gib nur das beschriebene JSON-Objekt zurück.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AnalysisParseError(
      "Die KI-Analyse lieferte keine verwertbare Antwort.",
    );
  }

  // Validierung per Zod. Bei fehlerhaften Antworten wird ein klarer Fehler
  // geworfen, damit das Dokument als "failed" markiert werden kann – kein
  // stiller Fallback, der wie ein Erfolg aussieht.
  const result = parseAnalysisResult(textBlock.text);
  if (!result.success) {
    throw new AnalysisParseError(result.error);
  }
  return result.data;
}
