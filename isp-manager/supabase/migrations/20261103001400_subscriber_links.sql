-- Phase 13: «رابط المشترك». A private read-only page per subscriber, opened
-- without login by a long random token. Additive only: subscriber rows are not touched.

create table public.subscriber_links (
  subscriber_id uuid primary key references public.subscribers (id),
  token         text not null unique check (token ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id)
);

-- Only through the functions below: nobody reads or writes the table directly.
alter table public.subscriber_links enable row level security;
revoke all on public.subscriber_links from anon, authenticated;
create trigger subscriber_links_no_delete before delete on public.subscriber_links for each row execute function public.forbid_delete();

-- 256 random bits, hex.
create or replace function private.new_link_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

-- Staff: the subscriber's link token (created on first use).
create or replace function public.subscriber_link(p_subscriber_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.can_access_subscriber(p_subscriber_id)
     or not exists (select 1 from public.subscribers where id = p_subscriber_id and deleted_at is null) then
    raise exception 'ليست لديك صلاحية لهذا المشترك' using errcode = '42501';
  end if;
  select token into v_token from public.subscriber_links where subscriber_id = p_subscriber_id;
  if v_token is null then
    insert into public.subscriber_links (subscriber_id, token, created_by)
    values (p_subscriber_id, private.new_link_token(), auth.uid())
    on conflict (subscriber_id) do nothing;
    select token into v_token from public.subscriber_links where subscriber_id = p_subscriber_id;
  end if;
  return v_token;
end;
$$;

-- Staff: replace the token; the old link stops working immediately.
create or replace function public.reset_subscriber_link(p_subscriber_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.new_link_token();
begin
  if not private.can_access_subscriber(p_subscriber_id)
     or not exists (select 1 from public.subscribers where id = p_subscriber_id and deleted_at is null) then
    raise exception 'ليست لديك صلاحية لهذا المشترك' using errcode = '42501';
  end if;
  insert into public.subscriber_links (subscriber_id, token, created_by)
  values (p_subscriber_id, v_token, auth.uid())
  on conflict (subscriber_id) do update set token = excluded.token, created_at = now(), created_by = excluded.created_by;
  return v_token;
end;
$$;

-- Public (no login): what the subscriber sees. Only these fields, only for a valid token.
create or replace function public.subscriber_public_view(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'full_name', o.full_name,
    'code', o.code,
    'package_name', o.package_name,
    'price', o.price,
    'start_date', o.start_date,
    'end_date', o.end_date,
    'days_left', o.days_left,
    'status', o.status,
    'balance', o.balance,
    'tower_name', o.tower_name,
    'payments', coalesce((
      select json_agg(json_build_object('receipt_no', p.receipt_no, 'amount', p.amount, 'paid_at', p.paid_at) order by p.paid_at desc)
      from (select receipt_no, amount, paid_at from public.payments
            where subscriber_id = o.id and not is_voided order by paid_at desc limit 5) p
    ), '[]'::json)
  )
  from public.subscriber_links l
  join public.subscribers s on s.id = l.subscriber_id and s.deleted_at is null
  join lateral (
    select s.id, s.full_name, s.code, pk.name as package_name, s.price, s.start_date, s.end_date,
      (s.end_date - public.today_baghdad()) as days_left,
      case
        when s.end_date is null then 'none'
        when s.end_date < public.today_baghdad() then 'expired'
        when s.end_date <= public.today_baghdad() + 3 then 'expiring'
        else 'active'
      end as status,
      s.balance, t.name as tower_name
    from public.towers t
    left join public.packages pk on pk.id = s.package_id
    where t.id = s.tower_id
  ) o on true
  where p_token ~ '^[0-9a-f]{64}$' and l.token = p_token
$$;

revoke all on function private.new_link_token() from public, anon, authenticated;
revoke all on function public.subscriber_link(uuid) from public, anon;
revoke all on function public.reset_subscriber_link(uuid) from public, anon;
revoke all on function public.subscriber_public_view(text) from public;
grant execute on function public.subscriber_link(uuid) to authenticated;
grant execute on function public.reset_subscriber_link(uuid) to authenticated;
grant execute on function public.subscriber_public_view(text) to anon, authenticated;
