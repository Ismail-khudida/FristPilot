import type { AllowedMimeType } from "./ai";

export interface DetectedFileType {
  mime: AllowedMimeType;
  ext: "pdf" | "jpg" | "png";
}

// Bestimmt den echten Dateityp anhand der Magic Bytes – nicht anhand des
// client-gesetzten file.type. Gibt null zurück, wenn der Typ nicht erlaubt ist.
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  // PDF: 25 50 44 46  ("%PDF")
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mime: "application/pdf", ext: "pdf" };
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  return null;
}

// Prüft, ob die Anfrage von einer eigenen App-Domain stammt (CSRF-Schutz).
// Mehrere Domains werden unterstützt (workers.dev + fristpilot.com/.app):
//   - APP_ORIGIN darf eine kommagetrennte Liste erlaubter Origins sein,
//   - zusätzlich gilt die Domain, an die die Anfrage tatsächlich ging
//     (x-forwarded-host/host), als erlaubt – so funktioniert die App auf jeder
//     verbundenen Domain ohne Code-Änderung.
function allowedOrigins(request: Request): Set<string> {
  const set = new Set<string>();
  (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((o) => set.add(o));

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) set.add(`${proto}://${host}`);

  const reqOrigin = safeOrigin(request.url);
  if (reqOrigin) set.add(reqOrigin);

  return set;
}

export function isAllowedOrigin(request: Request): boolean {
  const allowed = allowedOrigins(request);
  if (allowed.size === 0) return false;

  const origin = request.headers.get("origin");
  if (origin) return allowed.has(origin.replace(/\/$/, ""));

  // Kein Origin-Header (manche Browser bei same-origin POST): Referer prüfen.
  const referer = request.headers.get("referer");
  if (referer) {
    return [...allowed].some(
      (a) => referer === a || referer.startsWith(a + "/"),
    );
  }

  return false;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
