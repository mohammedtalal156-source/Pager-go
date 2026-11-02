-- Phase 9: manual debt adjustments (admin).
--
-- The balance stays a derived value: balance = total_due - total_paid, and
-- recompute_subscriber_balance() rebuilds both from source rows. An
-- adjustment is a separate, immutable row that is added to total_due, so:
--   * it is never a payment and never revenue (finance only sums payments);
--   * later payments, renewals and corrections keep working on top of it;
--   * nothing is counted twice because totals are always re-summed.
-- Additive only: no existing row is modified by this migration.

create table public.debt_adjustments (
  id                uuid primary key default gen_random_uuid(),
  subscriber_id     uuid not null references public.subscribers (id) on delete restrict,
  amount            bigint not null,           -- + raises the debt, - lowers it
  previous_balance  bigint not null,
  new_balance       bigint not null,
  reason            text not null,
  request_id        uuid,
  created_by        uuid not null references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now(),
  constraint debt_adjustments_amount_nonzero check (amount <> 0 and abs(amount) <= 1000000000),
  constraint debt_adjustments_math check (new_balance = previous_balance + amount),
  constraint debt_adjustments_new_balance check (new_balance between 0 and 1000000000),
  constraint debt_adjustments_reason_len check (char_length(btrim(reason)) between 3 and 300)
);
create index debt_adjustments_subscriber_idx on public.debt_adjustments (subscriber_id, created_at desc);
create unique index debt_adjustments_request_id_key on public.debt_adjustments (request_id) where request_id is not null;

-- Immutable + audited, like the other financial tables.
create trigger debt_adjustments_no_update before update on public.debt_adjustments for each row execute function public.forbid_update();
create trigger debt_adjustments_no_delete before delete on public.debt_adjustments for each row execute function public.forbid_delete();
create trigger audit_debt_adjustments after insert or update or delete on public.debt_adjustments
  for each row execute function public.audit_row_change();

-- Read: whoever may see the subscriber. Write: only through adjust_debt().
alter table public.debt_adjustments enable row level security;
create policy debt_adjustments_select on public.debt_adjustments
  for select to authenticated using (private.can_access_subscriber(subscriber_id));
revoke all on public.debt_adjustments from anon, authenticated, public;
grant select on public.debt_adjustments to authenticated;

-- ---------------------------------------------------------------------
-- Balance = periods + adjustments - payments (all from source rows)
-- ---------------------------------------------------------------------
create or replace function public.recompute_subscriber_balance(p_subscriber_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscribers s
  set total_due = coalesce((
        select sum(price) from public.subscriptions
        where subscriber_id = p_subscriber_id and not is_voided), 0)
      + coalesce((
        select sum(amount) from public.debt_adjustments
        where subscriber_id = p_subscriber_id), 0),
      total_paid = coalesce((
        select sum(amount) from public.payments
        where subscriber_id = p_subscriber_id and not is_voided), 0)
  where s.id = p_subscriber_id
$$;

create trigger debt_adjustments_recompute_balance
  after insert on public.debt_adjustments
  for each row execute function public.trg_recompute_balance();

-- ---------------------------------------------------------------------
-- adjust_debt: set the remaining debt to an exact amount (admin only)
--   p_expected_balance = the balance the admin saw; if it changed in the
--   meantime (payment, renewal, another admin) nothing is saved.
-- ---------------------------------------------------------------------
create or replace function public.adjust_debt(
  p_subscriber_id    uuid,
  p_new_balance      bigint,
  p_expected_balance bigint,
  p_reason           text,
  p_request_id       uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  s public.subscribers%rowtype;
  v_existing public.debt_adjustments%rowtype;
  v_id uuid;
  v_balance bigint;
begin
  if not private.is_admin() then
    raise exception 'تعديل الدين متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    raise exception 'اكتب سبب تعديل الدين' using errcode = 'P0001';
  end if;
  if p_new_balance is null or p_new_balance < 0 then
    raise exception 'الدين الجديد لا يمكن أن يكون سالباً' using errcode = 'P0001';
  end if;
  if p_new_balance > 1000000000 then
    raise exception 'المبلغ كبير جداً' using errcode = 'P0001';
  end if;

  select * into s from public.subscribers where id = p_subscriber_id for update;
  if not found then
    raise exception 'المشترك غير موجود' using errcode = 'P0001';
  end if;

  -- Double click / retry returns the first result (checked under the lock).
  if p_request_id is not null then
    select * into v_existing from public.debt_adjustments where request_id = p_request_id;
    if found then
      return json_build_object('adjustment_id', v_existing.id, 'previous_balance', v_existing.previous_balance,
        'new_balance', v_existing.new_balance, 'amount', v_existing.amount, 'balance', s.balance, 'duplicate', true);
    end if;
  end if;

  if p_expected_balance is not null and s.balance <> p_expected_balance then
    raise exception 'تغيّر دين المشترك أثناء التعديل (أصبح %). أغلق النافذة وأعد المحاولة', s.balance
      using errcode = 'P0001';
  end if;
  if p_new_balance = s.balance then
    raise exception 'الدين الجديد مطابق للدين الحالي' using errcode = 'P0001';
  end if;

  perform set_config('app.audit_reason',
    format('تعديل الدين من %s إلى %s: %s', s.balance, p_new_balance, v_reason), true);

  insert into public.debt_adjustments (subscriber_id, amount, previous_balance, new_balance, reason, request_id, created_by)
  values (s.id, p_new_balance - s.balance, s.balance, p_new_balance, v_reason, p_request_id, v_uid)
  returning id into v_id;

  select balance into v_balance from public.subscribers where id = s.id;
  if v_balance is distinct from p_new_balance then
    raise exception 'تعذر تطبيق التسوية بشكل صحيح' using errcode = 'P0001';
  end if;

  return json_build_object('adjustment_id', v_id, 'previous_balance', s.balance, 'new_balance', v_balance,
    'amount', p_new_balance - s.balance, 'balance', v_balance, 'duplicate', false);
end;
$$;

revoke all on function public.adjust_debt(uuid, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.adjust_debt(uuid, bigint, bigint, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- void_renewal: refuse (with a clear message) when a reducing adjustment
-- would make the amount due negative; otherwise unchanged.
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
  v_due_after bigint;
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
  select s.total_due - sb.price into v_due_after
  from public.subscribers s, public.subscriptions sb
  where s.id = r.subscriber_id and sb.id = r.subscription_id;
  if v_due_after < 0 then
    raise exception 'لا يمكن إلغاء هذا التجديد لأن تسوية الدين تجعل المستحق سالباً؛ عدّل الدين أولاً' using errcode = 'P0001';
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
-- History includes adjustments
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
       or (a.table_name in ('payments', 'subscriptions', 'renewals', 'debt_adjustments')
           and coalesce(a.new_data, a.old_data) ->> 'subscriber_id' = p_subscriber_id::text)
    order by a.occurred_at desc, a.id desc
    limit 300;
end;
$$;

-- ---------------------------------------------------------------------
-- Backups include adjustments; restore puts them back.
-- ---------------------------------------------------------------------
create or replace function private.backup_payload()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'isp-manager-backup',
    'version', 1,
    'created_at', now(),
    'towers',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.towers t),
    'packages',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.packages t),
    'profiles',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.profiles t),
    'subscribers',   (select coalesce(jsonb_agg(to_jsonb(t) - 'balance' - 'search_text' order by t.code), '[]') from public.subscribers t),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.subscriptions t),
    'payments',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.receipt_no), '[]') from public.payments t),
    'renewals',      (select coalesce(jsonb_agg(to_jsonb(t) - 'seq' order by t.seq), '[]') from public.renewals t),
    'expenses',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.expenses t),
    'debt_adjustments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.debt_adjustments t)
  )
$$;
revoke all on function private.backup_payload() from public, anon, authenticated;

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
    'expenses', (select count(*) from public.expenses),
    'debt_adjustments', (select count(*) from public.debt_adjustments)
  );
end;
$$;
