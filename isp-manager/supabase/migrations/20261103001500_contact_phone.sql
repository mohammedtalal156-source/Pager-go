-- Phase 14: manager phone on «رابط المشترك». Additive only.
-- Stored in private.app_settings (key 'contact_phone'). Until the admin sets it,
-- the first active admin's profile phone is used. An empty value hides it.

create or replace function private.contact_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from private.app_settings where key = 'contact_phone')
      then nullif((select value from private.app_settings where key = 'contact_phone'), '')
    else (select nullif(btrim(phone), '') from public.profiles
          where role = 'admin' and is_active and nullif(btrim(phone), '') is not null
          order by created_at limit 1)
  end
$$;

-- Admin: read / change the number shown to subscribers.
create or replace function public.get_contact_phone()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  return private.contact_phone();
end;
$$;

create or replace function public.set_contact_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[\s\-().]', '', 'g');
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  if v <> '' and v !~ '^\+?[0-9]{7,15}$' then
    raise exception 'رقم الهاتف غير صحيح' using errcode = 'P0001';
  end if;
  insert into private.app_settings (key, value) values ('contact_phone', v)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return nullif(v, '');
end;
$$;

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
    'contact_phone', private.contact_phone(),
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

revoke all on function private.contact_phone() from public, anon, authenticated;
revoke all on function public.get_contact_phone() from public, anon;
revoke all on function public.set_contact_phone(text) from public, anon;
grant execute on function public.get_contact_phone() to authenticated;
grant execute on function public.set_contact_phone(text) to authenticated;
