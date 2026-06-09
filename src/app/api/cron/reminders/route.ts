import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Versendet fällige Erinnerungen per E-Mail. Dieser Endpunkt ist KEIN
// Nutzer-Endpunkt: er wird von einem Scheduler (Cloudflare Cron Trigger,
// Supabase pg_cron oder ein externer Cron-Dienst) per HTTP aufgerufen und ist
// durch ein geheimes Bearer-Token geschützt.
//
// Warum hier ausnahmsweise der Service-Role-Key zum Einsatz kommt:
// Der Versand läuft ohne Nutzer-Session und muss über mehrere Konten hinweg
// fällige Erinnerungen lesen sowie die zugehörige E-Mail-Adresse auflösen.
// Das ist mit RLS/Session-Client nicht möglich. Der Key wird ausschließlich
// serverseitig in dieser Route verwendet und nie an den Browser ausgeliefert.

export const maxDuration = 60;

// Vorlaufzeit: Erinnerungen, die innerhalb der nächsten N Tage fällig sind
// (inkl. heute), werden einmalig verschickt.
const LEAD_DAYS = 3;

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

function buildEmail(reminders: DueReminder[], appUrl: string): string {
  const items = reminders
    .map(
      (r) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
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
        Diese Fristen werden bald fällig. Bitte prüfe, ob du handeln musst.
      </p>
      <table style="width:100%;border-collapse:collapse;">${items}</table>
      <div style="margin-top:24px;">
        <a href="${appUrl}/reminders" style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
          Alle Erinnerungen ansehen
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
  reminderCount: number,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY oder REMINDER_FROM_EMAIL fehlt.");
    return false;
  }
  const subject =
    reminderCount === 1
      ? "Eine Frist wird bald fällig"
      : `${reminderCount} Fristen werden bald fällig`;

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

  // Stichtag: heute + LEAD_DAYS (in Europe/Berlin gedacht – due_date ist ein
  // reines Datum ohne Zeitzone, daher genügt der Datumsvergleich).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + LEAD_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("reminders")
    .select("id, user_id, title, description, due_date")
    .eq("status", "open")
    .is("notified_at", null)
    .not("due_date", "is", null)
    .lte("due_date", cutoffDate)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Fällige Erinnerungen konnten nicht geladen werden:", error);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }

  const due = (data ?? []) as DueReminder[];
  if (due.length === 0) {
    return NextResponse.json({ sent: 0, reminders: 0 });
  }

  // Nach Nutzer gruppieren -> eine E-Mail pro Person.
  const byUser = new Map<string, DueReminder[]>();
  for (const r of due) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://fristpilot.ismailkhudida.workers.dev";

  let usersSent = 0;
  const notifiedIds: string[] = [];

  for (const [userId, reminders] of byUser) {
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userErr || !email) {
      console.error("E-Mail für Nutzer nicht auflösbar:", userId, userErr);
      continue;
    }

    const html = buildEmail(reminders, appUrl);
    const ok = await sendEmail(email, html, reminders.length);
    if (ok) {
      usersSent += 1;
      notifiedIds.push(...reminders.map((r) => r.id));
    }
  }

  // Nur erfolgreich versendete Erinnerungen als benachrichtigt markieren,
  // damit ein fehlgeschlagener Versand beim nächsten Lauf erneut versucht wird.
  if (notifiedIds.length > 0) {
    const { error: updateError } = await admin
      .from("reminders")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
    if (updateError) {
      console.error("notified_at konnte nicht gesetzt werden:", updateError);
    }
  }

  return NextResponse.json({
    sent: usersSent,
    reminders: notifiedIds.length,
  });
}
