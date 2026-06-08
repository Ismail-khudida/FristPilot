-- Migration: analysis_usage + Rate-Limit-Funktionen
-- Verbrauchszählung für Kostenkontrolle. Idempotent.

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

drop policy if exists "usage readable by owner" on public.analysis_usage;
create policy "usage readable by owner"
  on public.analysis_usage
  for select
  using (auth.uid() = user_id);

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

revoke all on function public.check_analysis_quota(int, int) from public;
revoke all on function public.consume_analysis(int, int) from public;
revoke all on function public.finalize_analysis(uuid, uuid, text) from public;
revoke all on function public.analysis_consumed_today(uuid) from public;
grant execute on function public.check_analysis_quota(int, int) to authenticated;
grant execute on function public.consume_analysis(int, int) to authenticated;
grant execute on function public.finalize_analysis(uuid, uuid, text) to authenticated;
