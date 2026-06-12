import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Dead-Man-Switch für den Erinnerungs-Versand.
// Liest den letzten protokollierten Lauf (cron_runs) und alarmiert per E-Mail,
// wenn er zu lange her ist (oder gar nicht existiert). Dieser Endpunkt wird von
// einem ZWEITEN, unabhängigen pg_cron-Job aufgerufen – fällt der Dispatch-Job
// still aus, schlägt dieser Check an, bevor Nutzer Fristen verpassen.
//
// Geschützt durch dasselbe Bearer-Token wie der Dispatch (CRON_SECRET).
// GET und POST werden unterstützt (GET ist für einfache externe Monitore bequem).

export const maxDuration = 30;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendAlert(lastRunIso: string | null, ageHours: number | null): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_FROM_EMAIL?.trim();
  const to = process.env.ALERT_EMAIL?.trim();
  if (!apiKey || !from || !to) {
    console.error("Alert nicht möglich: RESEND_API_KEY, REMINDER_FROM_EMAIL oder ALERT_EMAIL fehlt.");
    return false;
  }
  const detail = lastRunIso
    ? `Der letzte erfolgreiche Lauf war am ${lastRunIso} (vor ca. ${ageHours} Stunden).`
    : "Es wurde noch nie ein Lauf protokolliert.";
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:24px;">
    <h2 style="color:#b91c1c;margin:0 0 8px;">⚠️ Ordwell: Erinnerungs-Cron läuft nicht</h2>
    <p style="color:#0f172a;">Der Health-Check hat festgestellt, dass der automatische Erinnerungs-Versand
    (<code>/api/cron/reminders</code>) nicht wie erwartet gelaufen ist.</p>
    <p style="color:#475569;">${detail}</p>
    <p style="color:#475569;">Bitte den Supabase-pg_cron-Job <code>ordwell-reminders</code> prüfen.
    Solange er nicht läuft, werden KEINE Fristen-Erinnerungen verschickt.</p>
  </body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "⚠️ Ordwell: Erinnerungs-Cron läuft nicht",
      html,
    }),
  });
  if (!res.ok) {
    console.error("Alert-Versand fehlgeschlagen:", res.status, await res.text());
    return false;
  }
  return true;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server nicht konfiguriert." }, { status: 500 });
  }

  const maxAgeHours = Number(process.env.CRON_MAX_AGE_HOURS) || 26;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("cron_runs")
    .select("ran_at, ok")
    .eq("job", "reminders")
    .eq("ok", true)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("cron_runs konnte nicht gelesen werden:", error);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }

  const lastRunIso: string | null = data?.ran_at ?? null;
  const ageHours = lastRunIso
    ? Math.round((Date.now() - new Date(lastRunIso).getTime()) / 3_600_000)
    : null;

  const healthy = lastRunIso !== null && ageHours !== null && ageHours <= maxAgeHours;

  let alerted = false;
  if (!healthy) {
    alerted = await sendAlert(lastRunIso, ageHours);
  }

  return NextResponse.json(
    { healthy, lastRun: lastRunIso, ageHours, maxAgeHours, alerted },
    { status: healthy ? 200 : 503 },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
