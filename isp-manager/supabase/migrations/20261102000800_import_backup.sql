-- Phase 6: Excel import, backups and safe restore.

-- ---------------------------------------------------------------------
-- Import (admin): one transaction, idempotent per batch id.
-- Imported "remaining amount" becomes an opening-debt period (kind
-- 'import'); no payment is created, so it never counts as revenue.
-- ---------------------------------------------------------------------
create table if not exists private.import_batches (
  id          uuid primary key,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  inserted    int not null,
  skipped     int not null,
  towers_created int not null default 0
);
alter table private.import_batches enable row level security;
revoke all on private.import_batches from public, anon, authenticated;

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
    if exists (select 1 from public.subscribers where phone = r->>'phone') then
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

-- Phones already registered (for the import preview).
create or replace function public.existing_phones(p_phones text[])
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select phone from public.subscribers where phone = any(p_phones)
$$;

-- ---------------------------------------------------------------------
-- Backups
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
    'expenses',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from public.expenses t)
  )
$$;
revoke all on function private.backup_payload() from public, anon, authenticated;

create or replace function public.export_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'النسخ الاحتياطي متاح للمدير فقط' using errcode = '42501';
  end if;
  return private.backup_payload();
end;
$$;

-- Automatic snapshots (kept inside the project; also download copies regularly).
create table if not exists private.backups (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null default 'daily',
  size_bytes  int not null,
  data        jsonb not null
);
alter table private.backups enable row level security;
revoke all on private.backups from public, anon, authenticated;

create or replace function private.take_backup_snapshot(p_kind text default 'daily')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb := private.backup_payload();
  v_id bigint;
begin
  insert into private.backups (kind, size_bytes, data)
  values (p_kind, octet_length(v_data::text), v_data)
  returning id into v_id;
  -- keep the newest 30 snapshots
  delete from private.backups where id not in (select id from private.backups order by id desc limit 30);
  return v_id;
end;
$$;
revoke all on function private.take_backup_snapshot(text) from public, anon, authenticated;

create or replace function public.list_backups()
returns table (id bigint, created_at timestamptz, kind text, size_bytes int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  return query select b.id, b.created_at, b.kind, b.size_bytes from private.backups b order by b.id desc;
end;
$$;

create or replace function public.get_backup(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  select data into v from private.backups where id = p_id;
  if v is null then
    raise exception 'النسخة غير موجودة' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.create_backup_snapshot()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'متاح للمدير فقط' using errcode = '42501';
  end if;
  return private.take_backup_snapshot('manual');
end;
$$;

-- ---------------------------------------------------------------------
-- Restore (admin) — ONLY into an empty system, so it can never overwrite
-- or duplicate live data. Staff ids that don't exist here are mapped to
-- the restoring admin (collectors to "none").
-- ---------------------------------------------------------------------
create or replace function private.staff_or(p_id uuid, p_fallback uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_id is null then null
              when exists (select 1 from public.profiles where id = p_id) then p_id
              else p_fallback end
$$;
revoke all on function private.staff_or(uuid, uuid) from public, anon, authenticated;

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
    paid_at, notes, request_id, created_at, is_voided, voided_at, voided_by, void_reason)
  select id, receipt_no, subscriber_id, tower_id, subscription_id, kind, amount, private.staff_or(received_by, v_uid),
    paid_at, notes, request_id, created_at, is_voided, voided_at, private.staff_or(voided_by, v_uid), void_reason
  from jsonb_populate_recordset(null::public.payments, p_data->'payments');

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

revoke all on function public.import_subscribers(uuid, jsonb) from public, anon;
revoke all on function public.existing_phones(text[]) from public, anon;
revoke all on function public.export_backup() from public, anon;
revoke all on function public.list_backups() from public, anon;
revoke all on function public.get_backup(bigint) from public, anon;
revoke all on function public.create_backup_snapshot() from public, anon;
revoke all on function public.restore_backup(jsonb, text) from public, anon;
grant execute on function public.import_subscribers(uuid, jsonb) to authenticated;
grant execute on function public.existing_phones(text[]) to authenticated;
grant execute on function public.export_backup() to authenticated;
grant execute on function public.list_backups() to authenticated;
grant execute on function public.get_backup(bigint) to authenticated;
grant execute on function public.create_backup_snapshot() to authenticated;
grant execute on function public.restore_backup(jsonb, text) to authenticated;

-- Daily automatic snapshot at 03:30 Baghdad (00:30 UTC), where pg_cron exists.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('isp-daily-backup', '30 0 * * *', 'select private.take_backup_snapshot(''daily'')');
  end if;
end $$;
