import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Versendet fällige Erinnerungen per E-Mail – mit eskalierenden Stufen.
// Dieser Endpunkt ist KEIN Nutzer-Endpunkt: er wird von einem Scheduler
// (Supabase pg_cron) per HTTP aufgerufen und ist durch ein geheimes
// Bearer-Token geschützt.
//
// Eskalationsmodell: Jede Erinnerung wird mehrfach verschickt – 30, 14, 7 und
// 1 Tag(e) vor Fälligkeit sowie am Tag selbst. `notified_stages` hält fest,
// welche Stufen bereits raus sind, damit nichts doppelt verschickt wird.
// Liegt eine Erinnerung beim ersten Lauf schon näher an der Frist, werden
// übersprungene Stufen still als erledigt markiert (eine E-Mail, nicht vier).
//
// Warum hier ausnahmsweise der Service-Role-Key zum Einsatz kommt:
// Der Versand läuft ohne Nutzer-Session und muss über mehrere Konten hinweg
// fällige Erinnerungen lesen sowie die zugehörige E-Mail-Adresse auflösen.
// Das ist mit RLS/Session-Client nicht möglich. Der Key wird ausschließlich
// serverseitig in dieser Route verwendet und nie an den Browser ausgeliefert.

export const maxDuration = 60;

// Vorlaufstufen in Tagen, absteigend. 0 = am Tag der Fälligkeit (und danach,
// einmalig für Überfälliges).
const STAGES = [30, 14, 7, 1, 0] as const;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

interface DueReminder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  notified_stages: unknown;
}

interface PendingNotification {
  reminder: DueReminder;
  daysLeft: number;
  mergedStages: number[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateDe(date: string | null): string {
  if (!date) return "ohne festes Datum";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Tage bis zur Fälligkeit, rein über das Datum (due_date ist YYYY-MM-DD).
function daysUntil(due: string, today: string): number {
  const a = new Date(`${due}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft < 0) return `⚠️ Überfällig seit ${Math.abs(daysLeft)} Tag(en)`;
  if (daysLeft === 0) return "🚨 Heute fällig";
  if (daysLeft === 1) return "⏰ Morgen fällig";
  return `🗓️ In ${daysLeft} Tagen fällig`;
}

function parseStages(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is number => typeof n === "number");
}

function buildEmail(items: PendingNotification[], appUrl: string): string {
  const rows = items
    .map(
      ({ reminder: r, daysLeft }) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
            <span style="font-size:13px;font-weight:600;color:${daysLeft <= 1 ? "#b91c1c" : daysLeft <= 7 ? "#b45309" : "#1d4ed8"};">${urgencyLabel(daysLeft)}</span><br />
            <strong style="color:#0f172a;">${escapeHtml(r.title)}</strong><br />
            <span style="color:#64748b;font-size:14px;">Fällig: ${formatDateDe(r.due_date)}</span>
            ${r.description ? `<br /><span style="color:#475569;font-size:14px;">${escapeHtml(r.description)}</span>` : ""}
          </td>
        </tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
      <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">FristPilot – anstehende Fristen</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
        Diese Fristen brauchen deine Aufmerksamkeit. Bitte prüfe, ob du handeln musst.
      </p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:24px;">
        <a href="${appUrl}/dashboard" style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
          Zum Überblick
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        FristPilot erkennt mögliche Fristen automatisch und ohne Gewähr. Bitte
        prüfe wichtige Dokumente immer selbst.
      </p>
    </div>
  </body></html>`;
}

async function sendEmail(
  to: string,
  html: string,
  mostUrgent: PendingNotification,
  count: number,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY oder REMINDER_FROM_EMAIL fehlt.");
    return false;
  }
  const lead =
    mostUrgent.daysLeft <= 0
      ? "Frist heute fällig oder überfällig"
      : mostUrgent.daysLeft === 1
        ? "Frist morgen fällig"
        : `Frist in ${mostUrgent.daysLeft} Tagen`;
  const subject = count === 1 ? lead : `${lead} – und ${count - 1} weitere`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend-Versand fehlgeschlagen:", res.status, await res.text());
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server nicht konfiguriert." },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Heutiges Datum in Europe/Berlin (due_date ist ein reines Datum).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
  }).format(new Date());

  // Kandidaten: alle offenen, datierten Erinnerungen bis zur größten Vorlaufstufe.
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + STAGES[0]);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("reminders")
    .select("id, user_id, title, description, due_date, notified_stages")
    .eq("status", "open")
    .not("due_date", "is", null)
    .lte("due_date", horizonDate)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Fällige Erinnerungen konnten nicht geladen werden:", error);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }

  // Pro Erinnerung prüfen, ob eine neue Eskalationsstufe erreicht wurde.
  const pendingByUser = new Map<string, PendingNotification[]>();
  for (const r of (data ?? []) as DueReminder[]) {
    if (!r.due_date) continue;
    const daysLeft = daysUntil(r.due_date, today);
    const already = parseStages(r.notified_stages);
    // Alle Stufen, deren Vorlauf erreicht ist (bei daysLeft=3: 30, 14, 7).
    const reached = STAGES.filter((s) => daysLeft <= s);
    const fresh = reached.filter((s) => !already.includes(s));
    if (fresh.length === 0) continue;

    const merged = [...new Set([...already, ...reached])].sort((a, b) => b - a);
    const list = pendingByUser.get(r.user_id) ?? [];
    list.push({ reminder: r, daysLeft, mergedStages: merged });
    pendingByUser.set(r.user_id, list);
  }

  if (pendingByUser.size === 0) {
    return NextResponse.json({ sent: 0, reminders: 0 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://fristpilot.com";

  let usersSent = 0;
  let remindersSent = 0;

  for (const [userId, items] of pendingByUser) {
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userErr || !email) {
      console.error("E-Mail für Nutzer nicht auflösbar:", userId, userErr);
      continue;
    }

    // Dringendste zuerst (kleinste Resttage).
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    const ok = await sendEmail(
      email,
      buildEmail(items, appUrl),
      items[0],
      items.length,
    );
    if (!ok) continue;

    usersSent += 1;
    // Stufen erst nach erfolgreichem Versand markieren, damit ein Fehlschlag
    // beim nächsten Lauf erneut versucht wird.
    for (const item of items) {
      const { error: updateError } = await admin
        .from("reminders")
        .update({
          notified_stages: item.mergedStages,
          notified_at: new Date().toISOString(),
        })
        .eq("id", item.reminder.id);
      if (updateError) {
        console.error("notified_stages konnte nicht gesetzt werden:", updateError);
      } else {
        remindersSent += 1;
      }
    }
  }

  return NextResponse.json({ sent: usersSent, reminders: remindersSent });
}
