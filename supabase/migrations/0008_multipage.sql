-- Migration: Mehrseitige Dokumente
-- file_urls hält die Storage-Pfade aller Seiten in Reihenfolge (nur belegt,
-- wenn der Nutzer "Original behalten" gewählt hat). page_count zählt die Seiten.
-- Idempotent.

alter table public.documents
  add column if not exists file_urls jsonb;

alter table public.documents
  add column if not exists page_count int not null default 1;
