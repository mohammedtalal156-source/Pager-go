-- Phases 3–4: subscriber creation, renewal, collection, corrections.
-- Every operation is ONE function = ONE transaction, checks permissions
-- itself, locks the subscriber row, and is idempotent via request_id
-- (a double-click or network retry returns the first result).

alter table public.subscribers add column if not exists request_id uuid;

-- Strict insertion order for renewals (created_at ties inside one transaction).
alter table public.renewals add column if not exists seq bigint generated always as identity;
create index if not exists renewals_subscriber_seq_idx on public.renewals (subscriber_id, seq desc);
create unique index if not exists subscribers_request_id_key
  on public.subscribers (request_id) where request_id is not null;

-- ---------------------------------------------------------------------
-- create_subscriber
-- ---------------------------------------------------------------------
create or replace function public.create_subscriber(
  p_full_name    text,
  p_phone        text,
  p_tower_id     uuid,
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
  v_uid uuid := auth.uid();
  v_id uuid;
  v_sub_id uuid;
  v_days int;
  v_end date;
begin
  if not private.has_permission('create_subscribers') then
    raise exception 'ليست لديك صلاحية إضافة مشتركين' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select id into v_id from public.subscribers where request_id = p_request_id;
    if found then
      return json_build_object('id', v_id, 'duplicate', true);
    end if;
  end if;
  if not exists (select 1 from public.towers where id = p_tower_id and not is_archived) then
    raise exception 'البرج غير موجود أو مؤرشف' using errcode = 'P0001';
  end if;
  if p_collector_id is not null and not exists (
    select 1 from public.profiles where id = p_collector_id and is_active
  ) then
    raise exception 'المحصّل المحدد غير موجود' using errcode = 'P0001';
  end if;
  if coalesce(p_price, 0) < 0 or coalesce(p_amount_paid, 0) < 0 then
    raise exception 'المبالغ لا يمكن أن تكون سالبة' using errcode = 'P0001';
  end if;
  if coalesce(p_amount_paid, 0) > coalesce(p_price, 0) then
    raise exception 'المبلغ المدفوع أكبر من سعر الاشتراك' using errcode = 'P0001';
  end if;

  insert into public.subscribers (full_name, phone, phone2, tower_id, area, address, package_id,
                                  price, collector_id, notes, created_by, request_id)
  values (btrim(p_full_name), p_phone, nullif(p_phone2, ''), p_tower_id, nullif(btrim(coalesce(p_area, '')), ''),
          nullif(btrim(coalesce(p_address, '')), ''), p_package_id, coalesce(p_price, 0), p_collector_id,
          nullif(btrim(coalesce(p_notes, '')), ''), v_uid, p_request_id)
  returning id into v_id;

  -- First subscription period (optional: a subscriber can be added before activation).
  if p_start_date is not null then
    if p_end_date is null then
      select duration_days into v_days from public.packages where id = p_package_id;
      v_end := p_start_date + coalesce(v_days, 30);
    else
      v_end := p_end_date;
    end if;
    if v_end < p_start_date then
      raise exception 'تاريخ الانتهاء قبل تاريخ البداية' using errcode = 'P0001';
    end if;

    insert into public.subscriptions (subscriber_id, tower_id, package_id, kind, start_date, end_date, price, created_by)
    values (v_id, p_tower_id, p_package_id, 'new', p_start_date, v_end, coalesce(p_price, 0), v_uid)
    returning id into v_sub_id;

    update public.subscribers set start_date = p_start_date, end_date = v_end where id = v_id;

    if coalesce(p_amount_paid, 0) > 0 then
      insert into public.payments (subscriber_id, tower_id, subscription_id, kind, amount, received_by, request_id)
      values (v_id, p_tower_id, v_sub_id, 'new_subscription', p_amount_paid, v_uid, p_request_id);
    end if;
  elsif coalesce(p_amount_paid, 0) > 0 then
    raise exception 'حدد تاريخ بداية الاشتراك لتسجيل مبلغ مدفوع' using errcode = 'P0001';
  end if;

  return json_build_object('id', v_id, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------
-- renew_subscription
--   active  subscriber: new period starts the day after current end_date
--   expired subscriber: new period starts today (Baghdad)
--   admin may override the start date (p_start_override).
-- ---------------------------------------------------------------------
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
  v_days := coalesce(v_days, 30) * p_periods;

  if p_start_override is not null then
    v_start := p_start_override;
    v_end := p_start_override + v_days;
  elsif s.end_date is not null and s.end_date >= v_today then
    v_start := s.end_date + 1;
    v_end := s.end_date + v_days;
  else
    v_start := v_today;
    v_end := v_today + v_days;
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

-- ---------------------------------------------------------------------
-- record_payment (collection of an outstanding debt; partial allowed)
-- ---------------------------------------------------------------------
create or replace function public.record_payment(
  p_subscriber_id uuid,
  p_amount        bigint,
  p_notes         text default null,
  p_request_id    uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.subscribers%rowtype;
  v_existing public.payments%rowtype;
  v_pay_id uuid;
  v_receipt bigint;
  v_balance bigint;
begin
  if not private.has_permission('collect') then
    raise exception 'ليست لديك صلاحية تسجيل الدفعات' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select * into v_existing from public.payments where request_id = p_request_id;
    if found then
      select balance into v_balance from public.subscribers where id = v_existing.subscriber_id;
      return json_build_object('payment_id', v_existing.id, 'receipt_no', v_existing.receipt_no,
        'balance', v_balance, 'duplicate', true);
    end if;
  end if;
  if not private.can_access_subscriber(p_subscriber_id) then
    raise exception 'هذا المشترك غير مكلف بك' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'أدخل مبلغاً أكبر من صفر' using errcode = 'P0001';
  end if;

  select * into s from public.subscribers where id = p_subscriber_id for update;
  if not found then
    raise exception 'المشترك غير موجود' using errcode = 'P0001';
  end if;
  if p_amount > s.balance then
    raise exception 'المبلغ (%) أكبر من الدين المتبقي (%)', p_amount, s.balance using errcode = 'P0001';
  end if;

  insert into public.payments (subscriber_id, tower_id, kind, amount, received_by, notes, request_id)
  values (s.id, s.tower_id, 'collection', p_amount, v_uid, nullif(btrim(coalesce(p_notes, '')), ''), p_request_id)
  returning id, receipt_no into v_pay_id, v_receipt;

  select balance into v_balance from public.subscribers where id = s.id;
  return json_build_object('payment_id', v_pay_id, 'receipt_no', v_receipt, 'balance', v_balance, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin corrections (audited with a reason)
-- ---------------------------------------------------------------------
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub uuid;
  v_balance bigint;
begin
  if not private.is_admin() then
    raise exception 'إلغاء الدفعات متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب الإلغاء' using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.payments
  set is_voided = true, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_payment_id and not is_voided
  returning subscriber_id into v_sub;
  if v_sub is null then
    raise exception 'الدفعة غير موجودة أو ملغاة مسبقاً' using errcode = 'P0001';
  end if;
  select balance into v_balance from public.subscribers where id = v_sub;
  return json_build_object('balance', v_balance);
end;
$$;

-- Cancels the LATEST renewal of a subscriber: voids its period and payment
-- and restores the previous end date.
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
  if r.payment_id is not null then
    update public.payments
    set is_voided = true, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
    where id = r.payment_id and not is_voided;
  end if;
  -- Restore the previous period: its start comes from the latest remaining
  -- (non-voided) subscription period.
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

-- Manual date correction (e.g. after import or a mistake), admin only.
create or replace function public.set_subscriber_dates(
  p_subscriber_id uuid, p_start_date date, p_end_date date, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'تعديل التواريخ متاح للمدير فقط' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب التعديل' using errcode = 'P0001';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'تاريخ الانتهاء قبل تاريخ البداية' using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.subscribers set start_date = p_start_date, end_date = p_end_date where id = p_subscriber_id;
  if not found then
    raise exception 'المشترك غير موجود' using errcode = 'P0001';
  end if;
end;
$$;

-- Collectors list for assignment dropdowns (names only).
create or replace function public.list_collectors()
returns table (id uuid, full_name text, role public.staff_role)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.full_name, p.role from public.profiles p
  where p.is_active and (p.role = 'collector' or (p.role = 'employee' and p.can_collect))
  order by p.full_name
$$;

revoke all on function public.create_subscriber(text, text, uuid, uuid, bigint, date, date, bigint, text, text, text, text, uuid, uuid) from public, anon;
revoke all on function public.renew_subscription(uuid, int, bigint, bigint, uuid, date, uuid) from public, anon;
revoke all on function public.record_payment(uuid, bigint, text, uuid) from public, anon;
revoke all on function public.void_payment(uuid, text) from public, anon;
revoke all on function public.void_renewal(uuid, text) from public, anon;
revoke all on function public.set_subscriber_dates(uuid, date, date, text) from public, anon;
revoke all on function public.list_collectors() from public, anon;
grant execute on function public.create_subscriber(text, text, uuid, uuid, bigint, date, date, bigint, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.renew_subscription(uuid, int, bigint, bigint, uuid, date, uuid) to authenticated;
grant execute on function public.record_payment(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.void_renewal(uuid, text) to authenticated;
grant execute on function public.set_subscriber_dates(uuid, date, date, text) to authenticated;
grant execute on function public.list_collectors() to authenticated;

-- Subscriber edits by clients may not touch the idempotency key either.
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
    or new.request_id is distinct from old.request_id then
      raise exception 'لا يمكن تعديل التواريخ أو الأرصدة مباشرة؛ استخدم التجديد أو التحصيل'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
