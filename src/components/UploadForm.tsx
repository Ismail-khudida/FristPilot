"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = "application/pdf,image/jpeg,image/png";
const MAX_PAGES = 12;

type UploadStep = "idle" | "uploading" | "analyzing" | "done";

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  uploading: "Seiten werden hochgeladen…",
  analyzing: "Ordwell analysiert das Dokument…",
  done: "Analyse abgeschlossen!",
};

const ERROR_MESSAGES: Record<string, string> = {
  rate_limit: "Du hast heute dein tägliches Limit erreicht. Bitte versuche es morgen erneut.",
  file_too_large: "Die Datei ist zu groß. Bitte lade Dateien unter 10 MB hoch.",
  unsupported_type: "Dieses Dateiformat wird nicht unterstützt. Bitte PDF, JPG oder PNG hochladen.",
  not_authenticated: "Du bist nicht mehr angemeldet. Bitte lade die Seite neu.",
};

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [autoReminders, setAutoReminders] = useState(true);

  const busy = step === "uploading" || step === "analyzing";

  // Neue Dateien an die bestehende, geordnete Liste anhängen. Ein PDF ersetzt
  // die Auswahl (PDFs werden einzeln verarbeitet); Bilder werden gesammelt.
  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    setError(null);

    const pdfIncoming = list.find(isPdf);
    if (pdfIncoming) {
      // Bei PDF nur diese eine Datei – mehrseitige PDFs liest die KI selbst.
      setFiles([pdfIncoming]);
      return;
    }

    setFiles((prev) => {
      if (prev.some(isPdf)) return list; // vorher war ein PDF gewählt -> ersetzen
      const merged = [...prev, ...list];
      if (merged.length > MAX_PAGES) {
        setError(`Höchstens ${MAX_PAGES} Seiten pro Dokument.`);
        return merged.slice(0, MAX_PAGES);
      }
      return merged;
    });
  }

  function move(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeAt(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError("Bitte zuerst mindestens eine Datei auswählen.");
      return;
    }

    setStep("uploading");
    setProgress(20);

    try {
      const body = new FormData();
      // Reihenfolge der Seiten bleibt erhalten: in dieser Reihenfolge angehängt.
      for (const f of files) body.append("file", f);
      body.append("keep_original", keepOriginal ? "true" : "false");
      body.append("auto_reminders", autoReminders ? "true" : "false");

      setProgress(40);
      const res = await fetch("/api/upload", { method: "POST", body });
      setStep("analyzing");
      setProgress(70);

      const data = (await res.json()) as {
        documentId?: string | null;
        documentCount?: number;
        error?: string;
        code?: string;
      };

      setProgress(100);

      if (!res.ok) {
        const msg =
          data.code && ERROR_MESSAGES[data.code]
            ? ERROR_MESSAGES[data.code]
            : data.error ?? "Beim Hochladen ist ein Fehler aufgetreten.";
        setError(msg);
        if (data.documentId) {
          router.push(`/documents/${data.documentId}`);
          return;
        }
        setStep("idle");
        setProgress(0);
        return;
      }

      if (data.documentId) {
        setStep("done");
        // Wurden aus den Bildern mehrere getrennte Dokumente erkannt, geht es
        // zur Übersicht; bei genau einem direkt ins Dokument.
        if ((data.documentCount ?? 1) > 1) {
          router.push("/documents");
        } else {
          router.push(`/documents/${data.documentId}`);
        }
      } else {
        setError("Unerwartete Antwort vom Server.");
        setStep("idle");
        setProgress(0);
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setStep("idle");
      setProgress(0);
    }
  }

  const onlyPdf = files.length === 1 && isPdf(files[0]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop Zone */}
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-navy bg-navy/5"
            : files.length > 0
            ? "border-green-400 bg-green-50"
            : "border-gray-300 bg-surface-muted hover:border-navy/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            // erlaubt erneutes Auswählen derselben Datei
            e.target.value = "";
          }}
        />
        <div className="space-y-1">
          <div className="text-3xl">⬆️</div>
          <p className="text-sm text-ink-soft">
            {files.length > 0 ? "Weitere Seiten hinzufügen oder " : "Dateien hierher ziehen oder "}
            <span className="font-medium text-navy underline">auswählen</span>
          </p>
          <p className="text-xs text-gray-400">
            PDF oder mehrere Fotos (JPG/PNG) · max. 10 MB pro Seite
          </p>
        </div>
      </div>

      {/* Geordnete Seitenliste */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-soft">
            {onlyPdf
              ? "1 PDF-Dokument (mehrseitig wird automatisch erkannt)"
              : files.length === 1
                ? "1 Bild"
                : `${files.length} Bilder · Ordwell erkennt automatisch, ob es ein mehrseitiges Dokument oder mehrere Briefe sind`}
          </p>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-semibold text-navy">
                {onlyPdf ? "📄" : i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
              <span className="shrink-0 text-xs text-ink-soft">
                {(f.size / 1024 / 1024).toFixed(1)} MB
              </span>
              {!onlyPdf && files.length > 1 && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Nach oben"
                    className="rounded px-1.5 text-ink-soft hover:bg-surface-muted disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === files.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Nach unten"
                    className="rounded px-1.5 text-ink-soft hover:bg-surface-muted disabled:opacity-30"
                  >
                    ↓
                  </button>
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAt(i)}
                aria-label="Entfernen"
                className="shrink-0 rounded px-1.5 text-ink-soft hover:text-accent disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Aufbewahrung: Standard ist Löschen nach Analyse (Privacy by Default) */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={keepOriginal}
          disabled={busy}
          onChange={(e) => setKeepOriginal(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1e293b]"
        />
        <span className="text-sm">
          <span className="font-medium text-ink">Originalseiten im Archiv behalten</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            Standard: Die Originale werden nach der Analyse automatisch gelöscht,
            nur das Ergebnis bleibt. Aktiviere dies, wenn du die Seiten später
            wieder ansehen möchtest.
          </span>
        </span>
      </label>

      {/* Auto-Erinnerung: erkannte Fristen direkt als Erinnerung sichern */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={autoReminders}
          disabled={busy}
          onChange={(e) => setAutoReminders(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1e293b]"
        />
        <span className="text-sm">
          <span className="font-medium text-ink">Erkannte Fristen automatisch als Erinnerung speichern</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            Für klar erkennbare Fristen mit Datum legt Ordwell direkt eine
            Erinnerung an, damit du nichts verpasst. Du kannst sie jederzeit
            unter „Erinnerungen“ ändern oder löschen.
          </span>
        </span>
      </label>

      {/* Progress Bar */}
      {busy && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{STEP_LABELS[step]}</span>
            <span className="text-xs text-ink-soft">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-navy transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-ink-soft">
            <span className={step === "uploading" ? "font-medium text-navy" : "text-green-600"}>
              {step === "uploading" ? "→ " : "✓ "}Hochladen
            </span>
            <span className={step === "analyzing" ? "font-medium text-navy" : ""}>
              {step === "analyzing" ? "→ " : ""}Analyse
            </span>
            <span>Fristen erkennen</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={busy || files.length === 0} className="btn-primary">
          {busy
            ? STEP_LABELS[step]
            : files.length > 1
            ? `${files.length} Bilder hochladen & analysieren`
            : "Hochladen & analysieren"}
        </button>
        {files.length > 0 && !busy && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFiles([]);
              setError(null);
            }}
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </form>
  );
}
