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

// Prüft, ob die Anfrage von der eigenen App-Domain stammt (CSRF-Schutz).
// Erlaubte Domain via APP_ORIGIN; Fallback ist die Origin des Requests selbst,
// damit lokale Entwicklung ohne Konfiguration funktioniert.
export function isAllowedOrigin(request: Request): boolean {
  const configured = process.env.APP_ORIGIN?.trim();
  const allowed = configured || safeOrigin(request.url);
  if (!allowed) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    return origin === allowed;
  }

  // Kein Origin-Header (z. B. manche Browser bei same-origin POST):
  // auf den Referer zurückfallen.
  const referer = request.headers.get("referer");
  if (referer) {
    return referer === allowed || referer.startsWith(allowed + "/");
  }

  // Weder Origin noch Referer vorhanden -> ablehnen.
  return false;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
