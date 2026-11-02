-- Phase 8: safe corrections.
--   * correct_payment(): fixes a wrongly-entered amount by voiding the
--     original payment (with the reason) and inserting the correct one,
--     linked to it, in ONE transaction. Nothing is edited in place and the
--     original stays in the history and in audit_logs.
--   * void_renewal(): also voids correction payments of that renewal.
--   * subscriber_history(): the audit trail of one subscriber (admin only).
--   * restore_backup(): keeps the correction link.
-- Additive only: no existing row is modified by this migration.

-- ---------------------------------------------------------------------
-- Link a correction to the payment it replaces
-- ---------------------------------------------------------------------
alter table public.payments
  add column corrects_payment_id uuid references public.payments (id) on delete restrict;

-- A payment can be replaced only once (it is voided by the correction).
create unique index payments_corrects_key on public.payments (corrects_payment_id)
  where corrects_payment_id is not null;

-- Fast per-subscriber audit lookups for payments/subscriptions/renewals.
create index audit_logs_subscriber_idx on public.audit_logs ((coalesce(new_data, old_data) ->> 'subscriber_id'));

-- ---------------------------------------------------------------------
-- correct_payment (admin only, atomic, idempotent per request_id)
-- ---------------------------------------------------------------------
create or replace function public.correct_payment(
  p_payment_id uuid,
  p_amount     bigint,
  p_reason     text,
  p_request_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  o public.payments%rowtype;
  s public.subscribers%rowtype;
  v_existing public.payments%rowtype;
  v_new_id uuid;
  v_receipt bigint;
  v_balance bigint;
begin
  if not private.is_admin() then
    raise exception 'تصحيح الدفعات متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'اكتب سبب التصحيح' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000 then
    raise exception 'أدخل المبلغ الصحيح (أكبر من صفر)' using errcode = 'P0001';
  end if;

  select * into o from public.payments where id = p_payment_id;
  if not found then
    raise exception 'الدفعة غير موجودة' using errcode = 'P0001';
  end if;

  -- Same lock order as renew/record_payment: subscriber first, then payment.
  select * into s from public.subscribers where id = o.subscriber_id for update;
  select * into o from public.payments where id = p_payment_id for update;

  -- Double-click / retry: the same request returns the first result.
  if p_request_id is not null then
    select * into v_existing from public.payments where request_id = p_request_id;
    if found then
      select balance into v_balance from public.subscribers where id = v_existing.subscriber_id;
      return json_build_object('payment_id', v_existing.id, 'receipt_no', v_existing.receipt_no,
        'amount', v_existing.amount, 'balance', v_balance, 'duplicate', true);
    end if;
  end if;

  if o.is_voided then
    raise exception 'هذه الدفعة ملغاة أو مصحّحة مسبقاً' using errcode = 'P0001';
  end if;
  if p_amount = o.amount then
    raise exception 'المبلغ الصحيح مطابق للمبلغ المسجل' using errcode = 'P0001';
  end if;
  if s.total_paid - o.amount + p_amount > s.total_due then
    raise exception 'المبلغ الصحيح (%) يجعل المدفوع أكبر من المستحق (%)', p_amount, s.total_due - (s.total_paid - o.amount)
      using errcode = 'P0001';
  end if;

  perform set_config('app.audit_reason',
    format('تصحيح مبلغ الوصل #%s من %s إلى %s: %s', o.receipt_no, o.amount, p_amount, v_reason), true);

  update public.payments
  set is_voided = true, voided_at = now(), voided_by = v_uid,
      void_reason = format('تصحيح المبلغ إلى %s: %s', p_amount, v_reason)
  where id = o.id;

  -- Same cash event, correct amount: same date, receiver, period and kind,
  -- so daily revenue and collector reports move from the wrong to the right
  -- amount without counting anything twice.
  insert into public.payments (subscriber_id, tower_id, subscription_id, kind, amount, received_by, paid_at,
    notes, request_id, corrects_payment_id)
  values (o.subscriber_id, o.tower_id, o.subscription_id, o.kind, p_amount, o.received_by, o.paid_at,
    format('تصحيح للوصل #%s (كان %s)', o.receipt_no, o.amount), p_request_id, o.id)
  returning id, receipt_no into v_new_id, v_receipt;

  select balance into v_balance from public.subscribers where id = o.subscriber_id;
  return json_build_object('payment_id', v_new_id, 'receipt_no', v_receipt, 'old_amount', o.amount,
    'amount', p_amount, 'balance', v_balance, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------
-- void_renewal: same as before, but voids every live payment of the
-- renewal's period (the original one or its correction).
-- ---------------------------------------------------------------------
create or replace function public.void_renewal(p_renewal_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.renewals%rowtype;
  v_latest uuid;
  v_prev_start date;
  v_balance bigint;
begin
  if not private.is_admin() then
    raise exception 'إلغاء التجديد متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب الإلغاء' using errcode = 'P0001';
  end if;
  select * into r from public.renewals where id = p_renewal_id;
  if not found then
    raise exception 'التجديد غير موجود' using errcode = 'P0001';
  end if;
  perform 1 from public.subscribers where id = r.subscriber_id for update;
  select rn.id into v_latest
  from public.renewals rn join public.subscriptions sb on sb.id = rn.subscription_id
  where rn.subscriber_id = r.subscriber_id and not sb.is_voided
  order by rn.seq desc limit 1;
  if v_latest is distinct from r.id then
    raise exception 'يمكن إلغاء آخر تجديد فقط' using errcode = 'P0001';
  end if;

  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.subscriptions
  set is_voided = true, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = r.subscription_id;
  update public.payments
  set is_voided = true, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where not is_voided and (id = r.payment_id or subscription_id = r.subscription_id);
  select start_date into v_prev_start
  from public.subscriptions
  where subscriber_id = r.subscriber_id and not is_voided
  order by end_date desc limit 1;
  update public.subscribers s
  set end_date = r.previous_end_date,
      start_date = case
        when r.previous_end_date is null then null
        else least(coalesce(v_prev_start, s.start_date), r.previous_end_date)
      end
  where s.id = r.subscriber_id;

  select balance into v_balance from public.subscribers where id = r.subscriber_id;
  return json_build_object('balance', v_balance, 'end_date', r.previous_end_date);
end;
$$;

-- ---------------------------------------------------------------------
-- subscriber_history: who changed what, when and why (admin only)
-- ---------------------------------------------------------------------
create or replace function public.subscriber_history(p_subscriber_id uuid)
returns table (
  id bigint,
  occurred_at timestamptz,
  actor_name text,
  action text,
  table_name text,
  old_data jsonb,
  new_data jsonb,
  reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'سجل التعديلات متاح للمدير فقط' using errcode = '42501';
  end if;
  return query
    select a.id, a.occurred_at, p.full_name, a.action, a.table_name, a.old_data, a.new_data, a.reason
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor_id
    where (a.table_name = 'subscribers' and a.record_id = p_subscriber_id::text)
       or (a.table_name in ('payments', 'subscriptions', 'renewals')
           and coalesce(a.new_data, a.old_data) ->> 'subscriber_id' = p_subscriber_id::text)
    order by a.occurred_at desc, a.id desc
    limit 300;
end;
$$;

revoke all on function public.correct_payment(uuid, bigint, text, uuid) from public, anon;
revoke all on function public.subscriber_history(uuid) from public, anon;
grant execute on function public.correct_payment(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.subscriber_history(uuid) to authenticated;
revoke all on function public.void_renewal(uuid, text) from public, anon;
grant execute on function public.void_renewal(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- restore_backup: unchanged except that corrects_payment_id is restored.
-- ---------------------------------------------------------------------
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

  -- Restore cached dates exactly (balances were recomputed by triggers).
  update public.subscribers s
  set start_date = x.start_date, end_date = x.end_date
  from jsonb_populate_recordset(null::public.subscribers, p_data->'subscribers') x
  where x.id = s.id;

  perform setval('public.subscriber_code_seq', greatest((select coalesce(max(code), 1000) from public.subscribers), 1000));
  perform setval('public.payment_receipt_seq', greatest((select coalesce(max(receipt_no), 1) from public.payments), 1));

  return json_build_object(
    'towers', (select count(*) from public.towers),
    'packages', (select count(*) from public.packages),
    'subscribers', (select count(*) from public.subscribers),
    'payments', (select count(*) from public.payments),
    'expenses', (select count(*) from public.expenses)
  );
end;
$$;
