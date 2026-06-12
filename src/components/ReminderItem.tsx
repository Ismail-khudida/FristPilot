import Link from "next/link";
import { toggleReminder, deleteReminder } from "@/app/(app)/reminders/actions";
import { formatDate, dueLabel, daysUntil } from "@/lib/format";
import type { ReminderRow } from "@/lib/types";

export function ReminderItem({ reminder }: { reminder: ReminderRow }) {
  const done = reminder.status === "done";
  const days = daysUntil(reminder.due_date);
  const overdue = !done && days !== null && days < 0;

  return (
    <div
      className={`card flex flex-wrap items-start gap-4 ${
        done ? "opacity-60" : ""
      }`}
    >
      {/* Erledigt-Umschalter */}
      <form action={toggleReminder} className="pt-0.5">
        <input type="hidden" name="id" value={reminder.id} />
        <input type="hidden" name="status" value={done ? "open" : "done"} />
        <button
          type="submit"
          aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}
          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
            done
              ? "border-green-500 bg-green-500 text-white"
              : "border-gray-300 bg-white hover:border-navy"
          }`}
        >
          {done && <span className="text-xs leading-none">✓</span>}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`font-medium text-ink ${done ? "line-through" : ""}`}
        >
          {reminder.title}
        </p>
        {reminder.description && (
          <p className="mt-0.5 text-sm text-ink-soft">{reminder.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-ink-soft">{formatDate(reminder.due_date)}</span>
          {!done && reminder.due_date && (
            <span className={overdue ? "font-medium text-accent" : "text-ink-soft"}>
              {dueLabel(reminder.due_date)}
            </span>
          )}
          {!done && reminder.due_date && (
            <a
              href={`/api/reminders/${reminder.id}/ics`}
              className="text-navy underline"
            >
              📅 Zum Kalender
            </a>
          )}
          {reminder.document_id && (
            <Link
              href={`/documents/${reminder.document_id}`}
              className="text-navy underline"
            >
              Zum Dokument
            </Link>
          )}
        </div>
      </div>

      <form action={deleteReminder}>
        <input type="hidden" name="id" value={reminder.id} />
        <button
          type="submit"
          className="text-xs text-ink-soft underline hover:text-accent"
        >
          Löschen
        </button>
      </form>
    </div>
  );
}
