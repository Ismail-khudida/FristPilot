// Optionales Sentry-Error-Monitoring.
// Wenn SENTRY_DSN nicht gesetzt ist, sind alle Exporte No-Ops – die App
// funktioniert unverändert. Keine personenbezogenen Dokumentinhalte werden
// an Sentry gesendet.

interface SentryLike {
  withScope: (cb: (scope: { setTag: (k: string, v: string) => void; setExtra: (k: string, v: unknown) => void }) => void) => void;
  captureException: (err: unknown) => void;
  captureMessage: (msg: string, level: string) => void;
}

let sentryInstance: SentryLike | null = null;

async function getSentry(): Promise<SentryLike | null> {
  if (!process.env.SENTRY_DSN) return null;
  if (sentryInstance) return sentryInstance;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentryInstance = require("@sentry/nextjs") as SentryLike;
    return sentryInstance;
  } catch {
    return null;
  }
}

interface CaptureContext {
  /** Fehlerkategorie für Sentry-Gruppierung, z.B. "upload", "analysis", "auth" */
  category: "upload" | "analysis" | "storage" | "auth";
  /** Zusätzliche Metadaten – KEINE Dokumentinhalte oder personenbezogenen Daten */
  extra?: Record<string, string | number | boolean | null>;
}

export async function captureError(
  error: unknown,
  ctx: CaptureContext,
): Promise<void> {
  const sentry = await getSentry();
  if (!sentry) return;

  sentry.withScope((scope) => {
    scope.setTag("category", ctx.category);
    if (ctx.extra) {
      // Sicherstellen, dass nur nicht-sensitive Metadaten übergeben werden.
      Object.entries(ctx.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    sentry.captureException(error);
  });
}

export async function captureMessage(
  message: string,
  ctx: Omit<CaptureContext, "extra">,
): Promise<void> {
  const sentry = await getSentry();
  if (!sentry) return;

  sentry.withScope((scope) => {
    scope.setTag("category", ctx.category);
    sentry.captureMessage(message, "warning");
  });
}
