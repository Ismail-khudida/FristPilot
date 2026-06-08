"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = "application/pdf,image/jpeg,image/png";

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Bitte zuerst eine Datei auswählen.");
      return;
    }

    setStatus("uploading");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as {
        documentId?: string | null;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Beim Hochladen ist ein Fehler aufgetreten.");
        // Bei reinem Analyse-Fehler trotzdem zum (gespeicherten) Dokument.
        if (data.documentId) {
          router.push(`/documents/${data.documentId}`);
          return;
        }
        setStatus("idle");
        return;
      }

      if (data.documentId) {
        router.push(`/documents/${data.documentId}`);
      } else {
        setError("Unerwartete Antwort vom Server.");
        setStatus("idle");
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setStatus("idle");
    }
  }

  const busy = status === "uploading";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-surface-muted px-6 py-10 text-center transition-colors hover:border-navy/50"
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
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
          <p className="text-sm font-medium text-ink">{file.name}</p>
        ) : (
          <p className="text-sm text-ink-soft">
            Datei hierher ziehen oder <span className="text-navy underline">auswählen</span>
            <br />
            <span className="text-xs text-gray-400">PDF, JPG oder PNG (max. 10 MB)</span>
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      {busy && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          Dokument wird hochgeladen und analysiert. Das kann einen Moment
          dauern…
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={busy || !file} className="btn-primary">
          {busy ? "Wird analysiert…" : "Hochladen & analysieren"}
        </button>
        {file && !busy && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFile(null);
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
