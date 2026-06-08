import { RISK_LABELS, riskClasses } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

export function RiskBadge({ risk }: { risk: RiskLevel | string | null }) {
  const label =
    risk && risk in RISK_LABELS
      ? RISK_LABELS[risk as RiskLevel]
      : "Wichtigkeit unbekannt";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${riskClasses(
        risk,
      )}`}
    >
      {label}
    </span>
  );
}
