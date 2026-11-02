-- Move the RLS helper functions out of the API-exposed `public` schema so
-- they cannot be called as /rest/v1/rpc/... endpoints. Policies reference
-- functions by OID, so they keep working after the move. Functions whose
-- body calls another helper by name are re-created with the new name.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.current_staff_role() set schema private;
alter function public.has_permission(text) set schema private;
alter function public.is_staff() set schema private;
alter function public.is_admin() set schema private;
alter function public.can_access_subscriber(uuid) set schema private;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_staff_role() is not null
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() = 'admin', false)
$$;

create or replace function private.can_access_subscriber(p_subscriber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.current_staff_role()
    when 'admin' then true
    when 'employee' then true
    when 'collector' then exists (
      select 1 from public.subscribers s
      where s.id = p_subscriber_id and s.collector_id = auth.uid())
    else false
  end
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
