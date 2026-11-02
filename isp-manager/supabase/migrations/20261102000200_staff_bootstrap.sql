-- First-admin bootstrap, callable only from the server with the service
-- role (the /setup page, protected by SETUP_TOKEN). Succeeds only while the
-- system has no staff at all; serialised with an advisory lock.
create or replace function public.bootstrap_first_admin(
  p_user_id uuid,
  p_username text,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('isp_bootstrap_first_admin'));
  if exists (select 1 from public.profiles) then
    raise exception 'تم إعداد النظام مسبقاً' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, username, full_name, role, is_active,
    can_create_subscribers, can_edit_subscribers, can_renew, can_collect, can_view_finance)
  values (p_user_id, p_username, p_full_name, 'admin', true, true, true, true, true, true);
end;
$$;

create or replace function public.system_has_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles)
$$;

revoke all on function public.bootstrap_first_admin(uuid, text, text) from public, anon, authenticated;
revoke all on function public.system_has_staff() from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(uuid, text, text) to service_role;
grant execute on function public.system_has_staff() to service_role;
