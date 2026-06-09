-- Migration: Erinnerungs-Versand (Reminder Dispatch)
-- Ergänzt die Spalten, die ein Cron-Job braucht, um fällige Erinnerungen
-- per E-Mail zu verschicken, ohne sie doppelt zu senden. Idempotent.

alter table public.reminders
  add column if not exists notified_at timestamptz;

-- Index für die Cron-Abfrage: offene, datierte, noch nicht benachrichtigte
-- Erinnerungen schnell finden.
create index if not exists reminders_dispatch_idx
  on public.reminders (status, due_date)
  where status = 'open' and notified_at is null;
