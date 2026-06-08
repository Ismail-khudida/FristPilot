"use client";

import { useActionState } from "react";
import {
  deleteDocument,
  type DeleteDocumentState,
} from "@/app/(app)/documents/actions";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [state, formAction, pending] = useActionState<
    DeleteDocumentState,
    FormData
  >(deleteDocument, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Dieses Dokument wirklich löschen? Datei, Analyse und verknüpfte Erinnerungen werden unwiderruflich entfernt.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={documentId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary text-accent hover:bg-accent-soft"
      >
        {pending ? "Wird gelöscht…" : "Dokument löschen"}
      </button>
      {state.error && (
        <p className="mt-2 text-sm text-accent">{state.error}</p>
      )}
    </form>
  );
}
