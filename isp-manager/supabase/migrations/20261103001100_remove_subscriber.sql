-- Phase 10: «حذف المشترك» (admin). Nothing is physically removed:
--   * every payment, period and debt adjustment of the subscriber is voided
--     / zeroed with the reason, so revenue, debt and reports no longer
--     count them;
--   * the subscriber gets deleted_at and RLS hides it from every screen,
--     report, export and count (all report functions are security invoker);
--   * nothing new can be recorded for a deleted subscriber;
--   * the data stays in the database and the audit log, so it can be
--     recovered by the administrator if deleted by mistake.

alter table public.subscribers
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id);

alter policy subscribers_select on public.subscribers
  using (
    deleted_at is null and (
      private.current_staff_role() in ('admin', 'employee')
      or (private.current_staff_role() = 'collector' and collector_id = (select auth.uid()))
    )
  );
alter policy subscribers_update on public.subscribers
  using (deleted_at is null and private.has_permission('edit_subscribers'))
  with check (deleted_at is null and private.has_permission('edit_subscribers'));

-- deleted_at / deleted_by can only be set by delete_subscriber().
create or replace function public.subscribers_protect_system_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.code       is distinct from old.code
    or new.start_date is distinct from old.start_date
    or new.end_date   is distinct from old.end_date
    or new.total_due  is distinct from old.total_due
    or new.total_paid is distinct from old.total_paid
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.request_id is distinct from old.request_id
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by then
      raise exception 'لا يمكن تعديل التواريخ أو الأرصدة مباشرة؛ استخدم التجديد أو التحصيل'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- No new period, payment or adjustment for a deleted subscriber.
create or replace function private.block_deleted_subscriber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.subscribers where id = new.subscriber_id and deleted_at is not null) then
    raise exception 'هذا المشترك محذوف' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.block_deleted_subscriber() from public, anon, authenticated;
create trigger subscriptions_block_deleted before insert on public.subscriptions
  for each row execute function private.block_deleted_subscriber();
create trigger payments_block_deleted before insert on public.payments
  for each row execute function private.block_deleted_subscriber();
create trigger debt_adjustments_block_deleted before insert on public.debt_adjustments
  for each row execute function private.block_deleted_subscriber();

create or replace function public.delete_subscriber(p_subscriber_id uuid, p_confirm text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.subscribers%rowtype;
  v_reason text;
  v_adj bigint;
  v_bal bigint;
  v_pay int;
  v_paid bigint;
  v_periods int;
begin
  if not private.is_admin() then
    raise exception 'حذف المشتركين متاح للمدير فقط' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'حذف' then
    raise exception 'اكتب كلمة «حذف» للتأكيد' using errcode = 'P0001';
  end if;
  select * into s from public.subscribers where id = p_subscriber_id for update;
  if not found or s.deleted_at is not null then
    raise exception 'المشترك غير موجود أو محذوف مسبقاً' using errcode = 'P0001';
  end if;

  v_reason := format('حذف المشترك #%s (%s)', s.code, s.full_name);
  perform set_config('app.audit_reason', v_reason, true);

  select count(*), coalesce(sum(amount), 0) into v_pay, v_paid
  from public.payments where subscriber_id = s.id and not is_voided;
  select count(*) into v_periods from public.subscriptions where subscriber_id = s.id and not is_voided;

  -- 1) payments out of revenue
  update public.payments
  set is_voided = true, voided_at = now(), voided_by = v_uid, void_reason = v_reason
  where subscriber_id = s.id and not is_voided;

  -- 2) zero the debt adjustments (amount due never goes below zero)
  select coalesce(sum(amount), 0) into v_adj from public.debt_adjustments where subscriber_id = s.id;
  if v_adj <> 0 then
    select balance into v_bal from public.subscribers where id = s.id;
    insert into public.debt_adjustments (subscriber_id, amount, previous_balance, new_balance, reason, created_by)
    values (s.id, -v_adj, v_bal, v_bal - v_adj, v_reason, v_uid);
  end if;

  -- 3) periods out of the amount due
  update public.subscriptions
  set is_voided = true, voided_at = now(), voided_by = v_uid, void_reason = v_reason
  where subscriber_id = s.id and not is_voided;

  -- 4) hide
  update public.subscribers set deleted_at = now(), deleted_by = v_uid where id = s.id;

  return json_build_object('code', s.code, 'full_name', s.full_name, 'payments', v_pay,
    'paid', v_paid, 'periods', v_periods);
end;
$$;
revoke all on function public.delete_subscriber(uuid, text) from public, anon;
grant execute on function public.delete_subscriber(uuid, text) to authenticated;

-- Import: a deleted subscriber's phone does not block a new import.
create or replace function public.import_subscribers(p_batch_id uuid, p_rows jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r jsonb;
  v_tower uuid;
  v_pkg uuid;
  v_days int;
  v_id uuid;
  v_start date;
  v_end date;
  v_price bigint;
  v_rem bigint;
  v_ins int := 0;
  v_skip int := 0;
  v_towers int := 0;
  b private.import_batches%rowtype;
begin
  if not private.is_admin() then
    raise exception 'الاستيراد متاح للمدير فقط' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('isp_import'));
  select * into b from private.import_batches where id = p_batch_id;
  if found then
    return json_build_object('inserted', b.inserted, 'skipped', b.skipped, 'towers_created', b.towers_created, 'duplicate', true);
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'لا توجد صفوف للاستيراد' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'الحد الأقصى 5000 صف في المرة الواحدة' using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', 'استيراد من Excel', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    if exists (select 1 from public.subscribers where phone = r->>'phone' and deleted_at is null) then
      v_skip := v_skip + 1;
      continue;
    end if;

    v_tower := null;
    select id into v_tower from public.towers
    where lower(btrim(name)) = lower(btrim(r->>'tower')) and not is_archived;
    if v_tower is null then
      insert into public.towers (name, area, created_by)
      values (btrim(r->>'tower'), nullif(btrim(coalesce(r->>'area', '')), ''), v_uid)
      returning id into v_tower;
      v_towers := v_towers + 1;
    end if;

    v_pkg := null;
    v_days := null;
    if btrim(coalesce(r->>'package', '')) <> '' then
      select id, duration_days into v_pkg, v_days from public.packages
      where lower(btrim(name)) = lower(btrim(r->>'package'));
    end if;

    v_price := coalesce(nullif(r->>'price', '')::bigint, 0);
    v_rem := coalesce(nullif(r->>'remaining', '')::bigint, 0);
    v_start := nullif(r->>'start_date', '')::date;
    v_end := nullif(r->>'end_date', '')::date;
    if v_price < 0 or v_rem < 0 then
      raise exception 'مبلغ سالب في الصف للهاتف %', r->>'phone' using errcode = 'P0001';
    end if;

    insert into public.subscribers (full_name, phone, tower_id, area, package_id, price, created_by)
    values (btrim(r->>'full_name'), r->>'phone', v_tower, nullif(btrim(coalesce(r->>'area', '')), ''),
            v_pkg, v_price, v_uid)
    returning id into v_id;

    if v_end is not null or v_start is not null or v_rem > 0 then
      v_start := coalesce(v_start, v_end - coalesce(v_days, 30), public.today_baghdad());
      v_end := coalesce(v_end, v_start + coalesce(v_days, 30));
      if v_end < v_start then v_start := v_end; end if;
      insert into public.subscriptions (subscriber_id, tower_id, package_id, kind, start_date, end_date, price, created_by)
      values (v_id, v_tower, v_pkg, 'import', v_start, v_end, v_rem, v_uid);
      update public.subscribers set start_date = v_start, end_date = v_end where id = v_id;
    end if;
    v_ins := v_ins + 1;
  end loop;

  insert into private.import_batches (id, created_by, inserted, skipped, towers_created)
  values (p_batch_id, v_uid, v_ins, v_skip, v_towers);
  return json_build_object('inserted', v_ins, 'skipped', v_skip, 'towers_created', v_towers, 'duplicate', false);
end;
$$;

-- Restore keeps the deleted mark.
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
  set start_date = x.start_date, end_date = x.end_date,
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
