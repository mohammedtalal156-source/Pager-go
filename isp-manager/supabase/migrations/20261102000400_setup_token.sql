-- Setup token for the one-time /setup page, verified inside the database so
-- no secret has to be configured on the web host. Only its SHA-256 hash is
-- stored (set out-of-band, never committed):
--   select private.set_setup_token('<token>');
create table if not exists private.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table private.app_settings enable row level security;
revoke all on private.app_settings from public, anon, authenticated;

create or replace function private.set_setup_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.app_settings (key, value)
  values ('setup_token_sha256', encode(extensions.digest(p_token, 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value, updated_at = now()
$$;
revoke all on function private.set_setup_token(text) from public, anon, authenticated, service_role;

-- True only while no staff exists AND the token matches.
create or replace function public.check_setup_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles)
     and length(coalesce(p_token, '')) >= 16
     and exists (
       select 1 from private.app_settings
       where key = 'setup_token_sha256'
         and value = encode(extensions.digest(p_token, 'sha256'), 'hex'))
$$;
revoke all on function public.check_setup_token(text) from public, anon, authenticated;
grant execute on function public.check_setup_token(text) to service_role;
