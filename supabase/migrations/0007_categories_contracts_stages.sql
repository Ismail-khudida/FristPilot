-- Migration: Dokument-Kategorien + eskalierende Erinnerungsstufen
-- Idempotent – kann gefahrlos erneut ausgeführt werden.

-- Kategorie als eigene Spalte (denormalisiert aus analysis_json), damit das
-- Archiv serverseitig effizient filtern kann.
alter table public.documents
  add column if not exists category text;

create index if not exists documents_user_category_idx
  on public.documents (user_id, category);

-- Eskalierende Erinnerungen: welche Vorlaufstufen (30/14/7/1/0 Tage) wurden
-- bereits per E-Mail verschickt?
alter table public.reminders
  add column if not exists notified_stages jsonb not null default '[]'::jsonb;
