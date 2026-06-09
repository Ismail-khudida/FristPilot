-- FristPilot – Datenbank-Schema
-- Im Supabase SQL Editor ausführen.
-- Die Tabelle `auth.users` wird von Supabase Auth verwaltet.

-- ------------------------------------------------------------------
-- documents
-- ------------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  file_name       text not null,
  file_url        text,                 -- Pfad im Storage-Bucket
  file_type       text,                 -- z.B. application/pdf, image/png
  extracted_text  text,                 -- erkannter Rohtext (best effort)
  -- strukturiertes KI-Ergebnis. deadlines[] enthält pro Frist zusätzlich
  -- confidence, evidence_text und page_number zur Nachvollziehbarkeit.
  analysis_json   jsonb,
  -- Verarbeitungsstatus der Analyse.
  status          text not null default 'processing'
                    check (status in ('processing', 'done', 'failed')),
  analysis_error  text,                 -- kurze Fehlermeldung bei status='failed'
  created_at      timestamptz not null default now()
);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- Idempotentes Upgrade für bestehende Installationen (create table if not
-- exists fügt keine neuen Spalten zu einer vorhandenen Tabelle hinzu).
alter table public.documents
  add column if not exists status text not null default 'processing';
alter table public.documents
  add column if not exists analysis_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_status_check'
  ) then
    alter table public.documents
      add constraint documents_status_check
      check (status in ('processing', 'done', 'failed'));
  end if;
end $$;

-- Bestehende Dokumente mit Analyse als erledigt markieren.
update public.documents set status = 'done'
  where analysis_json is not null and status = 'processing';

-- ------------------------------------------------------------------
-- reminders
-- ------------------------------------------------------------------
create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  document_id   uuid references public.documents (id) on delete set null,
  title         text not null,
  description   text,
  due_date      date,
  status        text not null default 'open' check (status in ('open', 'done')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists reminders_user_id_status_idx
  on public.reminders (user_id, status, due_date);

-- ------------------------------------------------------------------
-- Row Level Security: Nutzer dürfen nur ihre eigenen Daten sehen.
-- ------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "documents are private" on public.documents;
create policy "documents are private"
  on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reminders are private" on public.reminders;
create policy "reminders are private"
  on public.reminders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Storage-Bucket für Dokumente
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Nutzer dürfen nur auf Dateien in ihrem eigenen Ordner (user_id/...) zugreifen.
drop policy if exists "users manage own files" on storage.objects;
create policy "users manage own files"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------
-- analysis_usage – Verbrauchszählung für Rate-Limiting & Kostenkontrolle
-- ------------------------------------------------------------------
create table if not exists public.analysis_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  document_id   uuid references public.documents (id) on delete set null,
  status        text not null
                  check (status in ('allowed', 'blocked', 'failed', 'completed')),
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists analysis_usage_created_at_idx
  on public.analysis_usage (created_at);
create index if not exists analysis_usage_user_created_idx
  on public.analysis_usage (user_id, created_at);

alter table public.analysis_usage enable row level security;

-- Nur lesbar für den Eigentümer (für spätere Auswertung). Schreibzugriff
-- erfolgt ausschließlich über die SECURITY-DEFINER-Funktionen unten.
drop policy if exists "usage readable by owner" on public.analysis_usage;
create policy "usage readable by owner"
  on public.analysis_usage
  for select
  using (auth.uid() = user_id);

-- Zählt heute verbrauchte Analysen (allowed/completed/failed gelten als Verbrauch).
create or replace function public.analysis_consumed_today(p_user_id uuid)
returns table (user_count bigint, global_count bigint)
language sql security definer set search_path = public, pg_temp
as $$
  select
    count(*) filter (where user_id = p_user_id) as user_count,
    count(*) as global_count
  from public.analysis_usage
  where created_at >= date_trunc('day', now())
    and status in ('allowed', 'completed', 'failed');
$$;

-- Vorprüfung (vor Upload): zählt nur, protokolliert ein 'blocked' bei Limit.
create or replace function public.check_analysis_quota(
  p_user_limit int,
  p_global_limit int
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_user bigint;
  v_global bigint;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  select user_count, global_count into v_user, v_global
    from public.analysis_consumed_today(v_uid);

  if v_global >= p_global_limit then
    insert into public.analysis_usage (user_id, status, reason)
      values (v_uid, 'blocked', 'global_limit');
    return jsonb_build_object('allowed', false, 'reason', 'global_limit');
  end if;

  if v_user >= p_user_limit then
    insert into public.analysis_usage (user_id, status, reason)
      values (v_uid, 'blocked', 'user_limit');
    return jsonb_build_object('allowed', false, 'reason', 'user_limit');
  end if;

  return jsonb_build_object('allowed', true, 'reason', null);
end;
$$;

-- Verbrauch buchen (nach erfolgreichem Upload, unmittelbar vor dem Claude-Aufruf).
-- Prüft atomar erneut und legt bei Erfolg eine 'allowed'-Zeile an.
create or replace function public.consume_analysis(
  p_user_limit int,
  p_global_limit int
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_user bigint;
  v_global bigint;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated', 'usage_id', null);
  end if;

  select user_count, global_count into v_user, v_global
    from public.analysis_consumed_today(v_uid);

  if v_global >= p_global_limit then
    insert into public.analysis_usage (user_id, status, reason)
      values (v_uid, 'blocked', 'global_limit') returning id into v_id;
    return jsonb_build_object('allowed', false, 'reason', 'global_limit', 'usage_id', v_id);
  end if;

  if v_user >= p_user_limit then
    insert into public.analysis_usage (user_id, status, reason)
      values (v_uid, 'blocked', 'user_limit') returning id into v_id;
    return jsonb_build_object('allowed', false, 'reason', 'user_limit', 'usage_id', v_id);
  end if;

  insert into public.analysis_usage (user_id, status, reason)
    values (v_uid, 'allowed', null) returning id into v_id;
  return jsonb_build_object('allowed', true, 'reason', null, 'usage_id', v_id);
end;
$$;

-- Verbrauchszeile nach der Analyse abschließen (completed/failed). Verhindert
-- Manipulation: nur eigene 'allowed'-Zeile, nur erlaubte Zielstatus.
create or replace function public.finalize_analysis(
  p_usage_id uuid,
  p_document_id uuid,
  p_status text
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.analysis_usage
    set status = p_status, document_id = p_document_id
    where id = p_usage_id
      and user_id = auth.uid()
      and status = 'allowed';
end;
$$;

-- ------------------------------------------------------------------
-- upload_consents – explizite Einwilligung zur KI-Datenübermittlung
-- ------------------------------------------------------------------
create table if not exists public.upload_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  consent_version text not null default '1',
  created_at      timestamptz not null default now()
);

create unique index if not exists upload_consents_user_version_uidx
  on public.upload_consents (user_id, consent_version);

alter table public.upload_consents enable row level security;

drop policy if exists "Users can read own consents" on public.upload_consents;
create policy "Users can read own consents"
  on public.upload_consents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own consents" on public.upload_consents;
create policy "Users can insert own consents"
  on public.upload_consents for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- analysis_feedback – Nutzerfeedback zur Analysequalität
-- ------------------------------------------------------------------
create table if not exists public.analysis_feedback (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  helpful      boolean not null,
  created_at   timestamptz not null default now()
);

create unique index if not exists analysis_feedback_doc_user_uidx
  on public.analysis_feedback (document_id, user_id);

alter table public.analysis_feedback enable row level security;

drop policy if exists "Users can manage own feedback" on public.analysis_feedback;
create policy "Users can manage own feedback"
  on public.analysis_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on function public.check_analysis_quota(int, int) from public;
revoke all on function public.consume_analysis(int, int) from public;
revoke all on function public.finalize_analysis(uuid, uuid, text) from public;
revoke all on function public.analysis_consumed_today(uuid) from public;
grant execute on function public.check_analysis_quota(int, int) to authenticated;
grant execute on function public.consume_analysis(int, int) to authenticated;
grant execute on function public.finalize_analysis(uuid, uuid, text) to authenticated;
