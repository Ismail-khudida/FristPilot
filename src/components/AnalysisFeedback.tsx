"use client";

import { useState } from "react";
import { recordFeedback } from "@/app/(app)/documents/actions";

export function AnalysisFeedback({ documentId }: { documentId: string }) {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(helpful: boolean) {
    setPending(true);
    await recordFeedback(documentId, helpful);
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-ink-soft">
        Danke für dein Feedback! Das hilft uns, Ordwell zu verbessern.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-sm text-ink-soft">
      <p>War diese Analyse hilfreich?</p>
      <div className="flex gap-3">
        <button
          disabled={pending}
          onClick={() => submit(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-green-400 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
        >
          👍 Hilfreich
        </button>
        <button
          disabled={pending}
          onClick={() => submit(false)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          👎 Fehler gefunden
        </button>
      </div>
    </div>
  );
}
