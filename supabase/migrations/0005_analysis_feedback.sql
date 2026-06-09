-- Nutzerfeedback zur Analysequalität (hilfreich / nicht hilfreich)
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
