import { createClient } from "@/lib/supabase/server";

// Liefert eine .ics-Kalenderdatei für eine einzelne Erinnerung, damit der Nutzer
// die Frist in seinen eigenen Kalender (Apple/Google/Outlook) übernehmen kann.
// Session-gebunden: RLS stellt sicher, dass nur eigene Erinnerungen abrufbar sind.

export const dynamic = "force-dynamic";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Maskiert Sonderzeichen gemäß iCalendar (RFC 5545).
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, description, due_date")
    .eq("id", id)
    .single();

  if (error || !data || !data.due_date) {
    return new Response("Erinnerung nicht gefunden oder ohne Datum.", {
      status: 404,
    });
  }

  // due_date ist ein reines Datum (YYYY-MM-DD) -> ganztägiges Ereignis.
  const m = String(data.due_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return new Response("Ungültiges Datum.", { status: 400 });
  }
  const dtStart = `${m[1]}${m[2]}${m[3]}`;

  // DTEND ist bei ganztägigen Ereignissen exklusiv -> Folgetag.
  const end = new Date(`${data.due_date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const dtEnd = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}`;

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const summary = escapeIcs(data.title || "Ordwell-Frist");
  const descParts = [data.description || "", "", "Erinnerung von Ordwell · ordwell.de"]
    .filter(Boolean)
    .join("\n");
  const description = escapeIcs(descParts);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ordwell//Erinnerung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.id}@ordwell.de`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    // Erinnerung am Vortag.
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = lines.join("\r\n") + "\r\n";

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ordwell-frist.ics"',
      "Cache-Control": "no-store",
    },
  });
}
