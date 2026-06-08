import type { SupabaseClient } from "@supabase/supabase-js";

// Tageslimits über Environment Variablen, mit sinnvollen Fallbacks.
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const USER_DAILY_LIMIT = intFromEnv("DAILY_USER_ANALYSIS_LIMIT", 10);
export const GLOBAL_DAILY_LIMIT = intFromEnv("DAILY_GLOBAL_ANALYSIS_LIMIT", 200);

export type QuotaReason =
  | "user_limit"
  | "global_limit"
  | "not_authenticated"
  | "invalid_response"
  | "error";

export interface QuotaResult {
  allowed: boolean;
  reason: QuotaReason | null;
  usageId: string | null;
}

function toQuotaResult(data: unknown): QuotaResult {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    return {
      allowed: o.allowed === true,
      reason: typeof o.reason === "string" ? (o.reason as QuotaReason) : null,
      usageId: typeof o.usage_id === "string" ? o.usage_id : null,
    };
  }
  return { allowed: false, reason: "invalid_response", usageId: null };
}

// Vorprüfung vor dem Upload. Fail-closed: bei einem DB-Fehler wird abgelehnt,
// damit niemals unkontrolliert Kosten entstehen.
export async function checkQuota(
  supabase: SupabaseClient,
): Promise<QuotaResult> {
  const { data, error } = await supabase.rpc("check_analysis_quota", {
    p_user_limit: USER_DAILY_LIMIT,
    p_global_limit: GLOBAL_DAILY_LIMIT,
  });
  if (error) {
    console.error("check_analysis_quota fehlgeschlagen:", error);
    return { allowed: false, reason: "error", usageId: null };
  }
  return toQuotaResult(data);
}

// Verbrauch buchen, unmittelbar bevor der Claude-Aufruf gestartet wird.
export async function consumeQuota(
  supabase: SupabaseClient,
): Promise<QuotaResult> {
  const { data, error } = await supabase.rpc("consume_analysis", {
    p_user_limit: USER_DAILY_LIMIT,
    p_global_limit: GLOBAL_DAILY_LIMIT,
  });
  if (error) {
    console.error("consume_analysis fehlgeschlagen:", error);
    return { allowed: false, reason: "error", usageId: null };
  }
  return toQuotaResult(data);
}

// Verbrauchszeile nach der Analyse abschließen (Status completed/failed).
export async function finalizeQuota(
  supabase: SupabaseClient,
  usageId: string | null,
  documentId: string | null,
  status: "completed" | "failed",
): Promise<void> {
  if (!usageId) return;
  const { error } = await supabase.rpc("finalize_analysis", {
    p_usage_id: usageId,
    p_document_id: documentId,
    p_status: status,
  });
  if (error) {
    console.error("finalize_analysis fehlgeschlagen:", error);
  }
}

// Neutrale, nutzerfreundliche Meldung pro Limit-Grund.
export function quotaMessage(reason: QuotaReason | null): string {
  switch (reason) {
    case "user_limit":
      return "Du hast dein Tageslimit für Dokumentanalysen erreicht. Bitte versuche es morgen erneut.";
    case "global_limit":
      return "Der Dienst ist aktuell stark ausgelastet. Bitte versuche es später erneut.";
    default:
      return "Die Analyse ist derzeit nicht möglich. Bitte versuche es später erneut.";
  }
}
