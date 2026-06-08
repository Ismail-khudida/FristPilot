// Gemeinsame Typen für FristPilot.
// Die Analyse-Typen werden aus dem Zod-Schema abgeleitet (Single Source of
// Truth) und hier wiederveröffentlicht, damit bestehende Importe weiter gelten.

export type {
  RiskLevel,
  Deadline,
  DocumentAnalysis,
} from "./analysis-schema";

import type { DocumentAnalysis } from "./analysis-schema";

export type DocumentStatus = "processing" | "done" | "failed";

export interface DocumentRow {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string | null;
  file_type: string | null;
  extracted_text: string | null;
  analysis_json: DocumentAnalysis | null;
  status: DocumentStatus;
  analysis_error: string | null;
  created_at: string;
}

export type ReminderStatus = "open" | "done";

export interface ReminderRow {
  id: string;
  user_id: string;
  document_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: ReminderStatus;
  created_at: string;
  completed_at: string | null;
}
