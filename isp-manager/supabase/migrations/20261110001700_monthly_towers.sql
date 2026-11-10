-- Phase 16: towers whose subscription period is a calendar month (11/11 → 11/12)
-- instead of a fixed number of days. Enabled for «الشورجه». Existing periods and
-- subscriber dates are not changed; the next renewal follows the new rule.

alter table public.towers add column monthly_period boolean not null default false;
update public.towers set monthly_period = true where id = 'f2b22e37-bbe3-4ea0-937c-2d90f3ab0b16';

-- New column at the end of the view (existing columns unchanged).
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
  (s.end_date - public.today_baghdad()) as days_left,
  s.pole,
  t.monthly_period as tower_monthly
from public.subscribers s
join public.towers t on t.id = s.tower_id
left join public.packages p on p.id = s.package_id;

create or replace function public.renew_subscription(
  p_subscriber_id   uuid,
  p_periods         int,
  p_price           bigint,
  p_amount_received bigint,
  p_package_id      uuid default null,
  p_start_override  date default null,
  p_request_id      uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.today_baghdad();
  s public.subscribers%rowtype;
  v_existing public.renewals%rowtype;
  v_pkg uuid;
  v_days int;
  v_monthly boolean;
  v_months int;
  v_start date;
  v_end date;
  v_sub_id uuid;
  v_pay_id uuid;
  v_renewal_id uuid;
  v_balance bigint;
begin
  if not private.has_permission('renew') then
    raise exception 'ليست لديك صلاحية تجديد الاشتراكات' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select * into v_existing from public.renewals where request_id = p_request_id;
    if found then
      select balance into v_balance from public.subscribers where id = v_existing.subscriber_id;
      return json_build_object('renewal_id', v_existing.id, 'start_date', v_existing.new_start_date,
        'end_date', v_existing.new_end_date, 'balance', v_balance, 'duplicate', true);
    end if;
  end if;
  if p_periods is null or p_periods < 1 or p_periods > 24 then
    raise exception 'مدة التجديد غير صحيحة' using errcode = 'P0001';
  end if;
  if coalesce(p_price, -1) < 0 or coalesce(p_amount_received, -1) < 0 then
    raise exception 'المبالغ غير صحيحة' using errcode = 'P0001';
  end if;
  if p_start_override is not null and not private.is_admin() then
    raise exception 'تعديل تاريخ البداية متاح للمدير فقط' using errcode = '42501';
  end if;

  select * into s from public.subscribers where id = p_subscriber_id for update;
  if not found or s.is_archived then
    raise exception 'المشترك غير موجود أو مؤرشف' using errcode = 'P0001';
  end if;
  if p_amount_received > s.balance + p_price then
    raise exception 'المبلغ المستلم (%) أكبر من المستحق (%)', p_amount_received, s.balance + p_price
      using errcode = 'P0001';
  end if;

  v_pkg := coalesce(p_package_id, s.package_id);
  select duration_days into v_days from public.packages where id = v_pkg;
  -- Towers with calendar-month periods: one package period = one month (11/11 → 11/12).
  select monthly_period into v_monthly from public.towers where id = s.tower_id;
  v_months := greatest(1, round(coalesce(v_days, 30) / 30.0)::int) * p_periods;
  v_days := coalesce(v_days, 30) * p_periods;

  if p_start_override is not null then
    v_start := p_start_override;
    v_end := case when v_monthly then (p_start_override + make_interval(months => v_months))::date else p_start_override + v_days end;
  elsif s.end_date is not null and s.end_date >= v_today then
    v_start := s.end_date + 1;
    v_end := case when v_monthly then (s.end_date + make_interval(months => v_months))::date else s.end_date + v_days end;
  else
    v_start := v_today;
    v_end := case when v_monthly then (v_today + make_interval(months => v_months))::date else v_today + v_days end;
  end if;

  perform set_config('app.audit_reason', 'تجديد اشتراك', true);

  insert into public.subscriptions (subscriber_id, tower_id, package_id, kind, start_date, end_date, price, created_by)
  values (s.id, s.tower_id, v_pkg, 'renewal', v_start, v_end, p_price, v_uid)
  returning id into v_sub_id;

  if p_amount_received > 0 then
    insert into public.payments (subscriber_id, tower_id, subscription_id, kind, amount, received_by, request_id)
    values (s.id, s.tower_id, v_sub_id, 'renewal', p_amount_received, v_uid, p_request_id)
    returning id into v_pay_id;
  end if;

  insert into public.renewals (subscriber_id, subscription_id, payment_id, previous_end_date, new_start_date,
    new_end_date, periods, price, amount_received, date_overridden, request_id, created_by)
  values (s.id, v_sub_id, v_pay_id, s.end_date, v_start, v_end, p_periods, p_price, p_amount_received,
    p_start_override is not null, p_request_id, v_uid)
  returning id into v_renewal_id;

  update public.subscribers
  set start_date = v_start,
      end_date = v_end,
      package_id = v_pkg,
      price = round(p_price::numeric / p_periods)::bigint
  where id = s.id;

  select balance into v_balance from public.subscribers where id = s.id;
  return json_build_object('renewal_id', v_renewal_id, 'start_date', v_start, 'end_date', v_end,
    'balance', v_balance, 'duplicate', false);
end;
$$;
