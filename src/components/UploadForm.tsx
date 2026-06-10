"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = "application/pdf,image/jpeg,image/png";

type UploadStep = "idle" | "uploading" | "analyzing" | "done";

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  uploading: "Datei wird hochgeladen…",
  analyzing: "KI analysiert Dokument…",
  done: "Analyse abgeschlossen!",
};

const ERROR_MESSAGES: Record<string, string> = {
  "rate_limit": "Du hast heute dein tägliches Limit erreicht. Bitte versuche es morgen erneut.",
  "file_too_large": "Die Datei ist zu groß. Bitte lade eine Datei unter 10 MB hoch.",
  "unsupported_type": "Dieses Dateiformat wird nicht unterstützt. Bitte PDF, JPG oder PNG hochladen.",
  "not_authenticated": "Du bist nicht mehr angemeldet. Bitte lade die Seite neu.",
};

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Bitte zuerst eine Datei auswählen.");
      return;
    }

    setStep("uploading");
    setProgress(20);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("keep_original", keepOriginal ? "true" : "false");

      setProgress(40);
      const res = await fetch("/api/upload", { method: "POST", body });
      setStep("analyzing");
      setProgress(70);

      const data = (await res.json()) as {
        documentId?: string | null;
        error?: string;
        code?: string;
      };

      setProgress(100);

      if (!res.ok) {
        const msg = data.code && ERROR_MESSAGES[data.code]
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
        router.push(`/documents/${data.documentId}`);
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

  const busy = step === "uploading" || step === "analyzing";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop Zone */}
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-navy bg-navy/5"
            : file
            ? "border-green-400 bg-green-50"
            : "border-gray-300 bg-surface-muted hover:border-navy/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) setFile(dropped);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="space-y-1">
            <div className="text-2xl">📄</div>
            <p className="font-medium text-ink">{file.name}</p>
            <p className="text-xs text-ink-soft">
              {(file.size / 1024 / 1024).toFixed(1)} MB · Klicken zum Ändern
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-3xl">⬆️</div>
            <p className="text-sm text-ink-soft">
              Datei hierher ziehen oder{" "}
              <span className="font-medium text-navy underline">auswählen</span>
            </p>
            <p className="text-xs text-gray-400">PDF, JPG oder PNG · max. 10 MB</p>
          </div>
        )}
      </div>

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
          <span className="font-medium text-ink">
            Originaldokument im Archiv behalten
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            Standard: Das Original wird nach der Analyse automatisch gelöscht,
            nur das Ergebnis bleibt. Aktiviere dies, wenn du die Datei später
            wieder ansehen möchtest.
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
              {step === "analyzing" ? "→ " : ""}KI-Analyse
            </span>
            <span>Fristen erkennen</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={busy || !file} className="btn-primary">
          {busy ? STEP_LABELS[step] : "Hochladen & analysieren"}
        </button>
        {file && !busy && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFile(null);
              setError(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </form>
  );
}
