-- Phase 11: «العامود» (pole) per subscriber. Additive only.

alter table public.subscribers add column pole text;
alter table public.subscribers add constraint subscribers_pole_len check (pole is null or char_length(pole) between 1 and 50);
create index subscribers_pole_idx on public.subscribers (pole) where pole is not null;

-- New column added at the end of the view (existing columns unchanged).
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
  s.pole
from public.subscribers s
join public.towers t on t.id = s.tower_id
left join public.packages p on p.id = s.package_id;

-- Create + pole in one transaction (same permissions and double-click safety
-- as create_subscriber, which does all the work).
create or replace function public.create_subscriber_with_pole(
  p_full_name    text,
  p_phone        text,
  p_tower_id     uuid,
  p_pole         text default null,
  p_package_id   uuid default null,
  p_price        bigint default 0,
  p_start_date   date default null,
  p_end_date     date default null,
  p_amount_paid  bigint default 0,
  p_phone2       text default null,
  p_area         text default null,
  p_address      text default null,
  p_notes        text default null,
  p_collector_id uuid default null,
  p_request_id   uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  r json;
begin
  r := public.create_subscriber(p_full_name, p_phone, p_tower_id, p_package_id, p_price, p_start_date, p_end_date,
    p_amount_paid, p_phone2, p_area, p_address, p_notes, p_collector_id, p_request_id);
  if not coalesce((r ->> 'duplicate')::boolean, false) then
    update public.subscribers set pole = nullif(btrim(coalesce(p_pole, '')), '') where id = (r ->> 'id')::uuid;
  end if;
  return r;
end;
$$;
revoke all on function public.create_subscriber_with_pole(text, text, uuid, text, uuid, bigint, date, date, bigint, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.create_subscriber_with_pole(text, text, uuid, text, uuid, bigint, date, date, bigint, text, text, text, text, uuid, uuid) to authenticated;

-- Restore keeps the pole.
create or replace function public.restore_backup(p_data jsonb, p_confirm text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'الاستعادة متاحة للمدير فقط' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'استعادة' then
    raise exception 'اكتب كلمة «استعادة» للتأكيد' using errcode = 'P0001';
  end if;
  if p_data->>'format' is distinct from 'isp-manager-backup' then
    raise exception 'الملف ليس نسخة احتياطية لهذا النظام' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.subscribers) or exists (select 1 from public.towers) or exists (select 1 from public.packages) then
    raise exception 'الاستعادة ممكنة فقط في نظام فارغ (لا أبراج ولا باقات ولا مشتركين)' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('isp_restore'));
  perform set_config('app.audit_reason', 'استعادة نسخة احتياطية', true);

  insert into public.towers (id, name, area, address, manager_name, manager_phone, notes, is_archived, archived_at, created_by, created_at, updated_at)
  select id, name, area, address, manager_name, manager_phone, notes, is_archived, archived_at,
         private.staff_or(created_by, v_uid), created_at, updated_at
  from jsonb_populate_recordset(null::public.towers, p_data->'towers');

  insert into public.packages (id, name, price, duration_days, description, is_active, created_at, updated_at)
  select id, name, price, duration_days, description, is_active, created_at, updated_at
  from jsonb_populate_recordset(null::public.packages, p_data->'packages');

  insert into public.subscribers (id, code, full_name, phone, phone2, tower_id, area, address, package_id, price,
    start_date, end_date, collector_id, notes, is_archived, archived_at, created_by, created_at, updated_at, request_id)
  select id, code, full_name, phone, phone2, tower_id, area, address, package_id, price,
    start_date, end_date, private.staff_or(collector_id, null), notes, is_archived, archived_at,
    private.staff_or(created_by, v_uid), created_at, updated_at, request_id
  from jsonb_populate_recordset(null::public.subscribers, p_data->'subscribers');

  insert into public.subscriptions (id, subscriber_id, tower_id, package_id, kind, start_date, end_date, price,
    created_by, created_at, is_voided, voided_at, voided_by, void_reason)
  select id, subscriber_id, tower_id, package_id, kind, start_date, end_date, price,
    private.staff_or(created_by, v_uid), created_at, is_voided, voided_at, private.staff_or(voided_by, v_uid), void_reason
  from jsonb_populate_recordset(null::public.subscriptions, p_data->'subscriptions');

  -- Adjustments before payments: each one was valid against the periods,
  -- so the amount due never dips below zero while rows are added back.
  insert into public.debt_adjustments (id, subscriber_id, amount, previous_balance, new_balance, reason, request_id, created_by, created_at)
  select id, subscriber_id, amount, previous_balance, new_balance, reason, request_id, private.staff_or(created_by, v_uid), created_at
  from jsonb_populate_recordset(null::public.debt_adjustments, coalesce(p_data->'debt_adjustments', '[]'::jsonb))
  order by created_at;

  insert into public.payments (id, receipt_no, subscriber_id, tower_id, subscription_id, kind, amount, received_by,
    paid_at, notes, request_id, created_at, is_voided, voided_at, voided_by, void_reason, corrects_payment_id)
  select id, receipt_no, subscriber_id, tower_id, subscription_id, kind, amount, private.staff_or(received_by, v_uid),
    paid_at, notes, request_id, created_at, is_voided, voided_at, private.staff_or(voided_by, v_uid), void_reason,
    corrects_payment_id
  from jsonb_populate_recordset(null::public.payments, p_data->'payments')
  order by receipt_no;

  insert into public.renewals (id, subscriber_id, subscription_id, payment_id, previous_end_date, new_start_date,
    new_end_date, periods, price, amount_received, date_overridden, request_id, created_by, created_at)
  select id, subscriber_id, subscription_id, payment_id, previous_end_date, new_start_date,
    new_end_date, periods, price, amount_received, date_overridden, request_id, private.staff_or(created_by, v_uid), created_at
  from jsonb_populate_recordset(null::public.renewals, p_data->'renewals')
  order by created_at;

  insert into public.expenses (id, category, amount, expense_date, tower_id, description, created_by, created_at,
    is_voided, voided_at, voided_by, void_reason)
  select id, category, amount, expense_date, tower_id, description, private.staff_or(created_by, v_uid), created_at,
    is_voided, voided_at, private.staff_or(voided_by, v_uid), void_reason
  from jsonb_populate_recordset(null::public.expenses, p_data->'expenses');

  -- Dates and the deleted mark are restored last (after periods/payments).
  update public.subscribers s
  set start_date = x.start_date, end_date = x.end_date, pole = x.pole,
      deleted_at = x.deleted_at, deleted_by = private.staff_or(x.deleted_by, v_uid)
  from jsonb_populate_recordset(null::public.subscribers, p_data->'subscribers') x
  where x.id = s.id;

  perform setval('public.subscriber_code_seq', greatest((select coalesce(max(code), 1000) from public.subscribers), 1000));
  perform setval('public.payment_receipt_seq', greatest((select coalesce(max(receipt_no), 1) from public.payments), 1));

  return json_build_object(
    'towers', (select count(*) from public.towers),
    'packages', (select count(*) from public.packages),
    'subscribers', (select count(*) from public.subscribers),
    'payments', (select count(*) from public.payments),
    'expenses', (select count(*) from public.expenses),
    'debt_adjustments', (select count(*) from public.debt_adjustments)
  );
end;
$$;
