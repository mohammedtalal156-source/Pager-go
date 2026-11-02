-- Phase 2: subscriber status view + dashboard / tower statistics.
-- Everything here is SECURITY INVOKER: numbers are computed under the
-- caller's RLS, so a collector only ever sees totals for their own
-- assigned subscribers.

-- Status buckets (Asia/Baghdad business day):
--   none      no subscription period yet
--   expired   end_date < today
--   expiring  today <= end_date <= today + 3   (still active)
--   active    end_date > today + 3
create or replace view public.subscriber_overview
with (security_invoker = true) as
select
  s.id, s.code, s.full_name, s.phone, s.phone2, s.tower_id, s.area, s.address,
  s.package_id, s.price, s.start_date, s.end_date, s.total_due, s.total_paid,
  s.balance, s.collector_id, s.notes, s.search_text, s.is_archived, s.created_at,
  t.name as tower_name,
  p.name as package_name,
  case
    when s.end_date is null then 'none'
    when s.end_date < public.today_baghdad() then 'expired'
    when s.end_date <= public.today_baghdad() + 3 then 'expiring'
    else 'active'
  end as status,
  (s.end_date - public.today_baghdad()) as days_left
from public.subscribers s
join public.towers t on t.id = s.tower_id
left join public.packages p on p.id = s.package_id;

revoke all on public.subscriber_overview from anon;
grant select on public.subscriber_overview to authenticated;

-- Headline numbers for the dashboard (optionally for one tower).
-- Revenue = actual non-voided payments only; debt is never counted as cash.
create or replace function public.dashboard_stats(p_tower_id uuid default null)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with d as (
    select public.today_baghdad() as today,
           (date_trunc('month', public.today_baghdad()))::date as month_start
  ),
  bounds as (
    select today, month_start,
           (today::timestamp at time zone 'Asia/Baghdad') as today_ts,
           (month_start::timestamp at time zone 'Asia/Baghdad') as month_ts
    from d
  ),
  subs as (
    select s.end_date, s.balance
    from public.subscribers s
    where not s.is_archived and (p_tower_id is null or s.tower_id = p_tower_id)
  ),
  pays as (
    select p.amount, p.paid_at
    from public.payments p, bounds b
    where not p.is_voided
      and p.paid_at >= b.month_ts
      and (p_tower_id is null or p.tower_id = p_tower_id)
  )
  select json_build_object(
    'total',            (select count(*) from subs),
    'active',           (select count(*) from subs, bounds b where end_date >= b.today),
    'expired',          (select count(*) from subs, bounds b where end_date < b.today),
    'expiring',         (select count(*) from subs, bounds b where end_date between b.today and b.today + 3),
    'no_subscription',  (select count(*) from subs where end_date is null),
    'towers',           (select count(*) from public.towers where not is_archived),
    'collected_today',  (select coalesce(sum(amount), 0) from pays, bounds b where paid_at >= b.today_ts),
    'collected_month',  (select coalesce(sum(amount), 0) from pays),
    'debt',             (select coalesce(sum(balance), 0) from subs where balance > 0),
    'debtors',          (select count(*) from subs where balance > 0)
  )
$$;

-- Per-tower numbers for the towers page.
create or replace function public.tower_stats()
returns table (
  tower_id uuid,
  subscribers bigint,
  active bigint,
  expiring bigint,
  expired bigint,
  debt numeric,
  collected_month numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select public.today_baghdad() as today,
           ((date_trunc('month', public.today_baghdad()))::date::timestamp at time zone 'Asia/Baghdad') as month_ts
  )
  select
    t.id,
    count(s.id),
    count(s.id) filter (where s.end_date >= b.today),
    count(s.id) filter (where s.end_date between b.today and b.today + 3),
    count(s.id) filter (where s.end_date < b.today),
    coalesce(sum(s.balance) filter (where s.balance > 0), 0),
    coalesce((
      select sum(p.amount) from public.payments p
      where p.tower_id = t.id and not p.is_voided and p.paid_at >= b.month_ts
    ), 0)
  from public.towers t
  cross join b
  left join public.subscribers s on s.tower_id = t.id and not s.is_archived
  group by t.id, b.today, b.month_ts
$$;

revoke all on function public.dashboard_stats(uuid) from public, anon;
revoke all on function public.tower_stats() from public, anon;
grant execute on function public.dashboard_stats(uuid) to authenticated;
grant execute on function public.tower_stats() to authenticated;
