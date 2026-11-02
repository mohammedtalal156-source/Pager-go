-- Phase 5: finance summary, reports, expense corrections.
-- Revenue = actual non-voided payments only (debt is never revenue).
-- All functions are SECURITY INVOKER: callers only see what RLS allows
-- (expenses require the view_finance permission).

create or replace function public.finance_summary(p_from date, p_to date, p_tower_id uuid default null)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select (p_from::timestamp at time zone 'Asia/Baghdad') as f,
           ((p_to + 1)::timestamp at time zone 'Asia/Baghdad') as t
  ),
  pays as (
    select p.amount, p.kind, (p.paid_at at time zone 'Asia/Baghdad')::date as d
    from public.payments p, b
    where not p.is_voided and p.paid_at >= b.f and p.paid_at < b.t
      and (p_tower_id is null or p.tower_id = p_tower_id)
  ),
  exps as (
    select e.amount, e.category, e.expense_date as d
    from public.expenses e
    where not e.is_voided and e.expense_date between p_from and p_to
      and (p_tower_id is null or e.tower_id = p_tower_id)
  ),
  days as (
    select generate_series(p_from, least(p_to, p_from + 400), interval '1 day')::date as d
  )
  select json_build_object(
    'from', p_from,
    'to', p_to,
    'collected', (select coalesce(sum(amount), 0) from pays),
    'payments_count', (select count(*) from pays),
    'collected_by_kind', (select coalesce(json_object_agg(kind, s), '{}'::json) from (select kind, sum(amount) s from pays group by kind) x),
    'expenses', (select coalesce(sum(amount), 0) from exps),
    'expenses_by_category', (select coalesce(json_object_agg(category, s), '{}'::json) from (select category, sum(amount) s from exps group by category) x),
    'net', (select coalesce(sum(amount), 0) from pays) - (select coalesce(sum(amount), 0) from exps),
    'debt', (select coalesce(sum(s.balance), 0) from public.subscribers s
             where not s.is_archived and s.balance > 0 and (p_tower_id is null or s.tower_id = p_tower_id)),
    'daily', (select coalesce(json_agg(json_build_object(
                'date', days.d,
                'collected', coalesce((select sum(amount) from pays where pays.d = days.d), 0),
                'expenses', coalesce((select sum(amount) from exps where exps.d = days.d), 0)
              ) order by days.d), '[]'::json) from days)
  )
$$;

-- Per-tower performance for a period.
create or replace function public.report_towers(p_from date, p_to date)
returns table (
  tower_id uuid, tower_name text, subscribers bigint, active bigint, expired bigint,
  new_subscribers bigint, renewals bigint, collected numeric, expenses numeric, net numeric, debt numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select public.today_baghdad() as today,
           (p_from::timestamp at time zone 'Asia/Baghdad') as f,
           ((p_to + 1)::timestamp at time zone 'Asia/Baghdad') as t
  )
  select
    t.id, t.name,
    (select count(*) from public.subscribers s where s.tower_id = t.id and not s.is_archived),
    (select count(*) from public.subscribers s, b where s.tower_id = t.id and not s.is_archived and s.end_date >= b.today),
    (select count(*) from public.subscribers s, b where s.tower_id = t.id and not s.is_archived and s.end_date < b.today),
    (select count(*) from public.subscribers s, b where s.tower_id = t.id and s.created_at >= b.f and s.created_at < b.t),
    (select count(*) from public.renewals r join public.subscriptions sb on sb.id = r.subscription_id, b
       where sb.tower_id = t.id and not sb.is_voided and r.created_at >= b.f and r.created_at < b.t),
    coalesce((select sum(p.amount) from public.payments p, b where p.tower_id = t.id and not p.is_voided and p.paid_at >= b.f and p.paid_at < b.t), 0),
    coalesce((select sum(e.amount) from public.expenses e where e.tower_id = t.id and not e.is_voided and e.expense_date between p_from and p_to), 0),
    coalesce((select sum(p.amount) from public.payments p, b where p.tower_id = t.id and not p.is_voided and p.paid_at >= b.f and p.paid_at < b.t), 0)
      - coalesce((select sum(e.amount) from public.expenses e where e.tower_id = t.id and not e.is_voided and e.expense_date between p_from and p_to), 0),
    coalesce((select sum(s.balance) from public.subscribers s where s.tower_id = t.id and not s.is_archived and s.balance > 0), 0)
  from public.towers t
  where not t.is_archived
  order by t.name
$$;

-- Collections per staff member for a period.
create or replace function public.report_collectors(p_from date, p_to date, p_tower_id uuid default null)
returns table (staff_id uuid, staff_name text, role public.staff_role, payments bigint, collected numeric, renewals bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select (p_from::timestamp at time zone 'Asia/Baghdad') as f,
           ((p_to + 1)::timestamp at time zone 'Asia/Baghdad') as t
  )
  select pr.id, pr.full_name, pr.role,
    count(p.id),
    coalesce(sum(p.amount), 0),
    count(p.id) filter (where p.kind = 'renewal')
  from public.payments p
  join public.profiles pr on pr.id = p.received_by
  cross join b
  where not p.is_voided and p.paid_at >= b.f and p.paid_at < b.t
    and (p_tower_id is null or p.tower_id = p_tower_id)
  group by pr.id, pr.full_name, pr.role
  order by 5 desc
$$;

create or replace function public.void_expense(p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'إلغاء المصروفات متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب الإلغاء' using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.expenses
  set is_voided = true, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_expense_id and not is_voided;
  if not found then
    raise exception 'المصروف غير موجود أو ملغى مسبقاً' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.finance_summary(date, date, uuid) from public, anon;
revoke all on function public.report_towers(date, date) from public, anon;
revoke all on function public.report_collectors(date, date, uuid) from public, anon;
revoke all on function public.void_expense(uuid, text) from public, anon;
grant execute on function public.finance_summary(date, date, uuid) to authenticated;
grant execute on function public.report_towers(date, date) to authenticated;
grant execute on function public.report_collectors(date, date, uuid) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;
