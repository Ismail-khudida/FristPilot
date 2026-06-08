-- Migration: documents.status + documents.analysis_error
-- Macht fehlgeschlagene Analysen sichtbar, statt einen Fallback wie Erfolg zu
-- speichern. Idempotent – kann gefahrlos erneut ausgeführt werden.

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

-- Bestehende Dokumente mit vorhandener Analyse als erledigt markieren.
update public.documents set status = 'done'
  where analysis_json is not null and status = 'processing';
