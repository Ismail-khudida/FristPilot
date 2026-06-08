import { createClient } from "@/lib/supabase/server";
import { ReminderItem } from "@/components/ReminderItem";
import type { ReminderRow } from "@/lib/types";

export default async function RemindersPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reminders")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  const reminders = (data ?? []) as ReminderRow[];
  const open = reminders.filter((r) => r.status === "open");
  const done = reminders.filter((r) => r.status === "done");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Erinnerungen</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Alle gespeicherten Fristen und Aufgaben an einem Ort.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Offen ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="card">
            <p className="text-sm text-ink-soft">
              Keine offenen Erinnerungen. Lade ein Dokument hoch, um aus einer
              Frist eine Erinnerung zu erstellen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Erledigt ({done.length})
          </h2>
          <div className="space-y-3">
            {done.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
