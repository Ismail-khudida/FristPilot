-- Migration: Cron-Heartbeat (Dead-Man-Switch für den Erinnerungs-Versand)
-- Der Reminder-Dispatch (/api/cron/reminders) schreibt nach JEDEM Lauf eine
-- Zeile hierher. Ein unabhängiger Health-Check (/api/cron/health) prüft, ob der
-- letzte Lauf nicht zu lange her ist, und alarmiert sonst per E-Mail.
-- So fällt ein stiller Cron-Ausfall auf, bevor Nutzer Fristen verpassen.
-- Idempotent.

create table if not exists public.cron_runs (
  id              uuid primary key default gen_random_uuid(),
  job             text not null default 'reminders',
  ran_at          timestamptz not null default now(),
  due_found       int,
  users_sent      int,
  reminders_sent  int,
  ok              boolean not null default true
);

create index if not exists cron_runs_job_ran_at_idx
  on public.cron_runs (job, ran_at desc);

-- RLS an, aber bewusst KEINE Policy: weder anon noch authenticated dürfen lesen
-- oder schreiben. Zugriff ausschließlich über den Service-Role-Key (umgeht RLS),
-- der nur serverseitig in den Cron-Endpunkten verwendet wird.
alter table public.cron_runs enable row level security;
