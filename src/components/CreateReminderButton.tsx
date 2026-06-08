"use client";

import { useActionState, useState } from "react";
import {
  createReminder,
  type ReminderActionState,
} from "@/app/(app)/reminders/actions";

interface Props {
  documentId: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultDueDate?: string | null;
}

// Klappt ein kleines Formular auf, um aus einer erkannten Frist eine
// Erinnerung zu erstellen.
export function CreateReminderButton({
  documentId,
  defaultTitle,
  defaultDescription,
  defaultDueDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ReminderActionState,
    FormData
  >(createReminder, {});

  if (state.success) {
    return (
      <p className="text-sm font-medium text-green-700">
        ✓ Erinnerung gespeichert.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-accent"
      >
        Erinnerung erstellen
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-surface-muted p-4">
      <input type="hidden" name="document_id" value={documentId} />
      <div>
        <label className="field-label">Titel</label>
        <input
          name="title"
          required
          defaultValue={defaultTitle}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Beschreibung</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={defaultDescription ?? ""}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Fälligkeitsdatum</label>
        <input
          name="due_date"
          type="date"
          defaultValue={defaultDueDate ?? ""}
          className="field-input"
        />
      </div>

      {state.error && (
        <p className="text-sm text-accent">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Speichern…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
