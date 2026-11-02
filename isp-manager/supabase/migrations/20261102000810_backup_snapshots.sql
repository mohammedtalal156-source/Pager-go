-- Phase 6b: automatic backup snapshots inside the project (newest 30 kept).
-- Needs approval when applied because old snapshots are deleted.

-- Automatic snapshots (kept inside the project; also download copies regularly).
create table if not exists private.backups (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null default 'daily',
  size_bytes  int not null,
  data        jsonb not null
);
alter table private.backups enable row level security;
revoke all on private.backups from public, anon, authenticated;

create or replace function private.take_backup_snapshot(p_kind text default 'daily')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb := private.backup_payload();
  v_id bigint;
begin
  insert into private.backups (kind, size_bytes, data)
  values (p_kind, octet_length(v_data::text), v_data)
  returning id into v_id;
  -- keep the newest 30 snapshots
  delete from private.backups where id not in (select id from private.backups order by id desc limit 30);
  return v_id;
end;
$$;
revoke all on function private.take_backup_snapshot(text) from public, anon, authenticated;

create or replace function public.list_backups()
returns table (id bigint, created_at timestamptz, kind text, size_bytes int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  return query select b.id, b.created_at, b.kind, b.size_bytes from private.backups b order by b.id desc;
end;
$$;

create or replace function public.get_backup(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  select data into v from private.backups where id = p_id;
  if v is null then
    raise exception 'النسخة غير موجودة' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.create_backup_snapshot()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  return private.take_backup_snapshot('manual');
end;
$$;

revoke all on function public.list_backups() from public, anon;
revoke all on function public.get_backup(bigint) from public, anon;
revoke all on function public.create_backup_snapshot() from public, anon;
grant execute on function public.list_backups() to authenticated;
grant execute on function public.get_backup(bigint) to authenticated;
grant execute on function public.create_backup_snapshot() to authenticated;

-- Daily automatic snapshot at 03:30 Baghdad (00:30 UTC), where pg_cron exists.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('isp-daily-backup', '30 0 * * *', 'select private.take_backup_snapshot(''daily'')');
  end if;
end $$;
