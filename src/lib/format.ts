import type { RiskLevel } from "./types";

// Deutsche Datumsformatierung, robust gegen fehlende/ungültige Werte.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Kein Datum";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Anzahl Tage bis zum Datum (negativ = überfällig). Null bei ungültigem Datum.
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days < 0) return `Überfällig seit ${Math.abs(days)} Tag(en)`;
  if (days === 0) return "Heute fällig";
  if (days === 1) return "Morgen fällig";
  return `In ${days} Tagen fällig`;
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Geringe Wichtigkeit",
  medium: "Mittlere Wichtigkeit",
  high: "Hohe Wichtigkeit",
};

export function riskClasses(risk: RiskLevel | string | null | undefined): string {
  switch (risk) {
    case "high":
      return "bg-accent-soft text-accent border border-accent/30";
    case "medium":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "low":
    default:
      return "bg-surface-muted text-ink-soft border border-gray-200";
  }
}
