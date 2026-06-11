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

Ein Dokument kann aus MEHREREN Seiten bestehen (mehrere Bilder oder ein mehrseitiges PDF). Betrachte immer ALLE Seiten gemeinsam als EIN zusammenhängendes Dokument. Fristen, Beträge und Zusammenhänge können sich über mehrere Seiten verteilen – berücksichtige den gesamten Inhalt, nicht nur die erste Seite.

Analysiere das Dokument und gib AUSSCHLIESSLICH ein JSON-Objekt zurück – kein einleitender Text, keine Erklärungen, keine Markdown-Codeblöcke.

Das JSON-Objekt hat exakt diese Struktur:
{
  "document_type": "Versicherung | Behörde | Vertrag | Rechnung | Sonstiges",
  "category": "behoerde | versicherung | gesundheit | vertrag | rechnung | mahnung | finanzen | wohnen | arbeit | familie | sonstiges",
  "sender": "Name des Absenders (oder 'Unbekannt')",
  "summary_simple": "Einfache, beruhigende Erklärung des Dokuments in 2-4 Sätzen, in klarer Alltagssprache, ohne Fachbegriffe",
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
- "category": Ordne das Dokument genau einem Lebensbereich zu. mahnung nur bei echten Mahnungen/Zahlungserinnerungen; gesundheit für Arzt/Krankenkasse/Befunde; wohnen für Miete/Nebenkosten/Strom/Gas; finanzen für Bank/Steuer/Finanzamt; familie für Kita/Schule/Unterhalt. Im Zweifel "sonstiges".
- "contract": NUR ausfüllen, wenn das Dokument ein laufendes Vertragsverhältnis beschreibt (Versicherungspolice, Abo, Miet-/Mobilfunk-/Energievertrag o. ä.) – sonst null. Beträge als Zahl (z. B. 49.90), nicht als Text. Felder, die nicht erkennbar sind, leer/null lassen – nichts erfinden.
- Erfinde keine Fristen. Wenn keine Frist erkennbar ist, gib ein leeres Array zurück.
- "evidence_text": Zitiere möglichst wörtlich die Stelle, die zur Frist führt, damit der Nutzer die Aussage nachvollziehen kann. Lass das Feld leer, wenn es keine eindeutige Stelle gibt.
- "deadline_type": Ordne jede Frist einem Typ zu. zahlungsfrist = Rechnung/Mahnung zu zahlen; kuendigungsfrist = letzter Termin zum Kündigen; widerspruchsfrist = Frist für Widerspruch/Einspruch (z. B. Behörde, Bescheid); nachreichfrist = Unterlagen einreichen/nachreichen; termin = fester Termin (z. B. Anhörung); vertragsverlaengerung = automatische Verlängerung droht; sonstige = nichts davon passt. Im Zweifel "sonstige".
- "page_number": Seitenzahl der Fundstelle (1-basiert). Wenn nicht bestimmbar, gib null an – rate nicht.
- "confidence" (pro Frist und gesamt) ist eine Zahl zwischen 0.0 und 1.0 und beschreibt, wie sicher du dir bist.
- "risk_level": high = wichtige mögliche Frist mit potenziellen rechtlichen/finanziellen Folgen, medium = relevant aber unkritisch, low = informativ.
- Sei vorsichtig: Im Zweifel weise auf Unsicherheit hin (niedrige confidence), statt zu raten.`;

export interface AnalyzeInput {
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

// Baut die Content-Blöcke für ALLE Seiten in Reihenfolge. Bei mehreren Bildern
// wird jeder Seite ein Text-Label vorangestellt, damit das Modell die
// Reihenfolge und Seitenzuordnung (page_number) zuverlässig erkennt. Ein
// mehrseitiges PDF bleibt EIN Dokument-Block – Claude liest dessen Seiten
// selbst.
function buildPageContent(pages: AnalyzeInput[]): Anthropic.ContentBlockParam[] {
  const multiple = pages.length > 1;
  const blocks: Anthropic.ContentBlockParam[] = [];
  pages.forEach((page, i) => {
    if (multiple) {
      blocks.push({ type: "text", text: `— Seite ${i + 1} von ${pages.length} —` });
    }
    blocks.push(buildContentBlock(page.data.toString("base64"), page.mimeType));
  });
  blocks.push({
    type: "text",
    text: multiple
      ? "Oben siehst du alle Seiten dieses einen Dokuments in Reihenfolge. Analysiere sie GEMEINSAM und gib nur das beschriebene JSON-Objekt zurück."
      : "Analysiere dieses Dokument und gib nur das beschriebene JSON-Objekt zurück.",
  });
  return blocks;
}

// Schickt das Dokument (eine oder mehrere Seiten) direkt an Claude. PDFs werden
// als Dokument-Block, Bilder als Bild-Block übergeben – Claude übernimmt
// Texterkennung (OCR) und Analyse in einem Schritt. Das Ergebnis wird per
// Zod-Schema validiert. Akzeptiert sowohl eine einzelne Seite als auch ein
// Array von Seiten (mehrere Bilder).
export async function analyzeDocument(
  input: AnalyzeInput | AnalyzeInput[],
): Promise<DocumentAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalysisConfigError("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const pages = Array.isArray(input) ? input : [input];
  if (pages.length === 0) {
    throw new AnalysisConfigError("Keine Seiten zur Analyse übergeben.");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPageContent(pages),
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
