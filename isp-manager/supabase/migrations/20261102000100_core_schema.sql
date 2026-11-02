-- =====================================================================
-- ISP Manager — core schema (single company, internal use)
-- Phase 1: tables, constraints, indexes, helpers, audit, RLS.
--
-- Conventions
--   * Money is Iraqi Dinar stored as whole numbers (bigint). No fractions.
--   * Timestamps are timestamptz (stored UTC). Business "days" are computed
--     in Asia/Baghdad via public.today_baghdad().
--   * Financial rows (subscriptions, renewals, payments, expenses) are never
--     deleted. Corrections are made by an admin "void" with a reason, which is
--     written to audit_logs.
--   * Clients never write financial rows directly: all financial writes go
--     through SECURITY DEFINER functions that check permissions and run in a
--     single transaction.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'employee', 'collector');

create type public.subscription_kind as enum ('new', 'renewal', 'import');

create type public.payment_kind as enum ('new_subscription', 'renewal', 'collection');

create type public.expense_category as enum (
  'electricity',        -- كهرباء
  'tower_maintenance',  -- صيانة الأبراج
  'salaries',           -- رواتب
  'upstream_internet',  -- أجور الإنترنت الرئيسي
  'rent',               -- إيجارات
  'other'               -- مصروفات أخرى
);

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------

-- Business date in Baghdad.
create or replace function public.today_baghdad()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Baghdad')::date
$$;

-- Normalises Arabic text for search: unifies alef/yaa/taa-marbuta forms,
-- removes diacritics and tatweel, converts Arabic-Indic digits to Latin.
create or replace function public.normalize_ar(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    translate(
      regexp_replace(coalesce(input, ''), '[\u064B-\u0652\u0640]', '', 'g'),
      'أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      'اااايه01234567890123456789'
    )
  )
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles (staff accounts; one row per auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete restrict,
  username                text not null,
  full_name               text not null,
  phone                   text,
  role                    public.staff_role not null default 'employee',
  is_active               boolean not null default true,
  -- Fine-grained permissions for the "employee" role. Admin always has all
  -- permissions; collector can only collect from assigned subscribers.
  can_create_subscribers  boolean not null default true,
  can_edit_subscribers    boolean not null default false,
  can_renew               boolean not null default true,
  can_collect             boolean not null default true,
  can_view_finance        boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,32}$'),
  constraint profiles_full_name_len check (char_length(btrim(full_name)) between 2 and 100)
);
create unique index profiles_username_key on public.profiles (username);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Permission helpers (used by RLS and by RPCs)
-- SECURITY DEFINER so they can read profiles regardless of the caller's RLS.
-- ---------------------------------------------------------------------
create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_staff_role() is not null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'admin', false)
$$;

-- perm: create_subscribers | edit_subscribers | renew | collect | view_finance
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when p.role = 'admin' then true
      when perm = 'create_subscribers' then p.role = 'employee' and p.can_create_subscribers
      when perm = 'edit_subscribers'   then p.role = 'employee' and p.can_edit_subscribers
      when perm = 'renew'              then p.role = 'employee' and p.can_renew
      when perm = 'collect'            then p.role in ('employee', 'collector') and p.can_collect
      when perm = 'view_finance'       then p.role = 'employee' and p.can_view_finance
      else false
    end
    from public.profiles p
    where p.id = auth.uid() and p.is_active
  ), false)
$$;

-- Keep at least one active admin at all times.
create or replace function public.ensure_active_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and is_active and id <> old.id
    ) then
      raise exception 'لا يمكن إزالة آخر مدير فعال في النظام'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_one_admin
  before update on public.profiles
  for each row execute function public.ensure_active_admin_remains();

-- ---------------------------------------------------------------------
-- towers
-- ---------------------------------------------------------------------
create table public.towers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  area           text,
  address        text,
  manager_name   text,
  manager_phone  text,
  notes          text,
  is_archived    boolean not null default false,
  archived_at    timestamptz,
  created_by     uuid references public.profiles (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint towers_name_len check (char_length(btrim(name)) between 1 and 100)
);
create unique index towers_name_active_key
  on public.towers (lower(btrim(name))) where not is_archived;

create trigger towers_set_updated_at
  before update on public.towers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- packages
-- ---------------------------------------------------------------------
create table public.packages (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  price          bigint not null,
  duration_days  integer not null default 30,
  description    text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint packages_name_len check (char_length(btrim(name)) between 1 and 100),
  constraint packages_price_range check (price between 0 and 100000000),
  constraint packages_duration_range check (duration_days between 1 and 366)
);
create unique index packages_name_key on public.packages (lower(btrim(name)));

create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- subscribers
-- start_date / end_date / total_due / total_paid are maintained by the
-- system (renewal & payment functions + balance trigger). Client roles
-- cannot change them directly (see subscribers_protect_system_columns).
-- ---------------------------------------------------------------------
create sequence public.subscriber_code_seq start with 1001;

create table public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  code          bigint not null default nextval('public.subscriber_code_seq'),
  full_name     text not null,
  phone         text not null,
  phone2        text,
  tower_id      uuid not null references public.towers (id) on delete restrict,
  area          text,
  address       text,
  package_id    uuid references public.packages (id) on delete restrict,
  price         bigint not null default 0,
  start_date    date,
  end_date      date,
  total_due     bigint not null default 0,
  total_paid    bigint not null default 0,
  balance       bigint generated always as (total_due - total_paid) stored,
  collector_id  uuid references public.profiles (id) on delete set null,
  notes         text,
  search_text   text generated always as (
                  public.normalize_ar(
                    full_name || ' ' || phone || ' ' || coalesce(phone2, '') || ' ' || code::text
                  )
                ) stored,
  is_archived   boolean not null default false,
  archived_at   timestamptz,
  created_by    uuid references public.profiles (id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint subscribers_name_len check (char_length(btrim(full_name)) between 2 and 150),
  constraint subscribers_phone_format check (phone ~ '^\+?[0-9]{7,15}$'),
  constraint subscribers_phone2_format check (phone2 is null or phone2 ~ '^\+?[0-9]{7,15}$'),
  constraint subscribers_price_range check (price between 0 and 100000000),
  constraint subscribers_dates check (start_date is null or end_date is null or end_date >= start_date),
  constraint subscribers_totals_nonneg check (total_due >= 0 and total_paid >= 0)
);
alter sequence public.subscriber_code_seq owned by public.subscribers.code;

create unique index subscribers_code_key on public.subscribers (code);
create index subscribers_tower_idx on public.subscribers (tower_id) where not is_archived;
create index subscribers_end_date_idx on public.subscribers (end_date) where not is_archived;
create index subscribers_collector_idx on public.subscribers (collector_id) where collector_id is not null;
create index subscribers_debt_idx on public.subscribers (balance) where balance > 0;
create index subscribers_phone_idx on public.subscribers (phone);
create index subscribers_search_trgm_idx
  on public.subscribers using gin (search_text extensions.gin_trgm_ops);

create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

-- Client roles (anon/authenticated) may edit descriptive fields only.
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
    or new.created_at is distinct from old.created_at then
      raise exception 'لا يمكن تعديل التواريخ أو الأرصدة مباشرة؛ استخدم التجديد أو التحصيل'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger subscribers_protect_system_columns
  before update on public.subscribers
  for each row execute function public.subscribers_protect_system_columns();

-- ---------------------------------------------------------------------
-- subscriptions: one row per billed period. price = amount owed for it.
-- tower_id is a snapshot, so per-tower reports stay correct if the
-- subscriber later moves to another tower.
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references public.subscribers (id) on delete restrict,
  tower_id       uuid not null references public.towers (id) on delete restrict,
  package_id     uuid references public.packages (id) on delete restrict,
  kind           public.subscription_kind not null,
  start_date     date not null,
  end_date       date not null,
  price          bigint not null,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  is_voided      boolean not null default false,
  voided_at      timestamptz,
  voided_by      uuid references public.profiles (id),
  void_reason    text,
  constraint subscriptions_dates check (end_date >= start_date),
  constraint subscriptions_price_range check (price between 0 and 1000000000),
  constraint subscriptions_void_consistency check (
    (not is_voided and voided_at is null and voided_by is null and void_reason is null)
    or (is_voided and voided_at is not null and char_length(btrim(coalesce(void_reason, ''))) >= 3)
  )
);
create index subscriptions_subscriber_idx on public.subscriptions (subscriber_id, start_date desc);
create index subscriptions_tower_created_idx on public.subscriptions (tower_id, created_at);

-- ---------------------------------------------------------------------
-- payments: actual cash received. Revenue = sum of non-voided payments.
-- request_id makes each submission idempotent (double-click safe).
-- ---------------------------------------------------------------------
create sequence public.payment_receipt_seq start with 1;

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  receipt_no       bigint not null default nextval('public.payment_receipt_seq'),
  subscriber_id    uuid not null references public.subscribers (id) on delete restrict,
  tower_id         uuid not null references public.towers (id) on delete restrict,
  subscription_id  uuid references public.subscriptions (id) on delete restrict,
  kind             public.payment_kind not null,
  amount           bigint not null,
  received_by      uuid not null references public.profiles (id) on delete restrict,
  paid_at          timestamptz not null default now(),
  notes            text,
  request_id       uuid,
  created_at       timestamptz not null default now(),
  is_voided        boolean not null default false,
  voided_at        timestamptz,
  voided_by        uuid references public.profiles (id),
  void_reason      text,
  constraint payments_amount_range check (amount between 1 and 1000000000),
  constraint payments_void_consistency check (
    (not is_voided and voided_at is null and voided_by is null and void_reason is null)
    or (is_voided and voided_at is not null and char_length(btrim(coalesce(void_reason, ''))) >= 3)
  )
);
alter sequence public.payment_receipt_seq owned by public.payments.receipt_no;

create unique index payments_receipt_no_key on public.payments (receipt_no);
create unique index payments_request_id_key on public.payments (request_id) where request_id is not null;
create index payments_subscriber_idx on public.payments (subscriber_id, paid_at desc);
create index payments_paid_at_idx on public.payments (paid_at) where not is_voided;
create index payments_tower_paid_at_idx on public.payments (tower_id, paid_at) where not is_voided;
create index payments_received_by_idx on public.payments (received_by, paid_at) where not is_voided;

-- ---------------------------------------------------------------------
-- renewals: operation log of each renewal (who, when, old/new dates).
-- ---------------------------------------------------------------------
create table public.renewals (
  id                  uuid primary key default gen_random_uuid(),
  subscriber_id       uuid not null references public.subscribers (id) on delete restrict,
  subscription_id     uuid not null references public.subscriptions (id) on delete restrict,
  payment_id          uuid references public.payments (id) on delete restrict,
  previous_end_date   date,
  new_start_date      date not null,
  new_end_date        date not null,
  periods             integer not null,
  price               bigint not null,
  amount_received     bigint not null default 0,
  date_overridden     boolean not null default false,
  request_id          uuid,
  created_by          uuid not null references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now(),
  constraint renewals_dates check (new_end_date >= new_start_date),
  constraint renewals_periods_range check (periods between 1 and 24),
  constraint renewals_amounts check (price >= 0 and amount_received >= 0)
);
create unique index renewals_subscription_key on public.renewals (subscription_id);
create unique index renewals_request_id_key on public.renewals (request_id) where request_id is not null;
create index renewals_created_at_idx on public.renewals (created_at desc);
create index renewals_subscriber_idx on public.renewals (subscriber_id, created_at desc);

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  category      public.expense_category not null,
  amount        bigint not null,
  expense_date  date not null default public.today_baghdad(),
  tower_id      uuid references public.towers (id) on delete restrict, -- null = general
  description   text,
  created_by    uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  created_at    timestamptz not null default now(),
  is_voided     boolean not null default false,
  voided_at     timestamptz,
  voided_by     uuid references public.profiles (id),
  void_reason   text,
  constraint expenses_amount_range check (amount between 1 and 1000000000),
  constraint expenses_void_consistency check (
    (not is_voided and voided_at is null and voided_by is null and void_reason is null)
    or (is_voided and voided_at is not null and char_length(btrim(coalesce(void_reason, ''))) >= 3)
  )
);
create index expenses_date_idx on public.expenses (expense_date) where not is_voided;
create index expenses_tower_date_idx on public.expenses (tower_id, expense_date) where not is_voided;

-- ---------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  action       text not null,              -- INSERT | UPDATE | DELETE | VOID | ...
  table_name   text not null,
  record_id    text,
  old_data     jsonb,
  new_data     jsonb,
  reason       text
);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- Generic row-change audit. Functions can attach a reason for the current
-- transaction with: perform set_config('app.audit_reason', '...', true);
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id');

  -- Skip no-op updates and updates that only touch updated_at.
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, reason)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    v_id,
    v_old,
    v_new,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return null;
end;
$$;

create trigger audit_profiles      after insert or update or delete on public.profiles      for each row execute function public.audit_row_change();
create trigger audit_towers        after insert or update or delete on public.towers        for each row execute function public.audit_row_change();
create trigger audit_packages      after insert or update or delete on public.packages      for each row execute function public.audit_row_change();
create trigger audit_subscribers   after insert or update or delete on public.subscribers   for each row execute function public.audit_row_change();
create trigger audit_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.audit_row_change();
create trigger audit_payments      after insert or update or delete on public.payments      for each row execute function public.audit_row_change();
create trigger audit_renewals      after insert or update or delete on public.renewals      for each row execute function public.audit_row_change();
create trigger audit_expenses      after insert or update or delete on public.expenses      for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Financial immutability: no DELETE ever; UPDATE only to void (once).
-- Applies to every role, including service_role and table owner.
-- ---------------------------------------------------------------------
create or replace function public.forbid_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'حذف السجلات من الجدول % غير مسموح', tg_table_name
    using errcode = '42501';
end;
$$;

create or replace function public.financial_row_void_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_voided then
    raise exception 'هذه الحركة ملغاة مسبقاً ولا يمكن تعديلها' using errcode = '42501';
  end if;
  if not new.is_voided then
    raise exception 'لا يمكن تعديل الحركات المالية؛ المسموح فقط إلغاؤها من قبل المدير مع ذكر السبب'
      using errcode = '42501';
  end if;
  -- Only the void columns may change.
  if (to_jsonb(new) - array['is_voided','voided_at','voided_by','void_reason'])
     <> (to_jsonb(old) - array['is_voided','voided_at','voided_by','void_reason']) then
    raise exception 'عند الإلغاء لا يمكن تغيير بيانات الحركة' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'تعديل السجلات في الجدول % غير مسموح', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger subscriptions_no_delete before delete on public.subscriptions for each row execute function public.forbid_delete();
create trigger payments_no_delete      before delete on public.payments      for each row execute function public.forbid_delete();
create trigger renewals_no_delete      before delete on public.renewals      for each row execute function public.forbid_delete();
create trigger expenses_no_delete      before delete on public.expenses      for each row execute function public.forbid_delete();
create trigger audit_logs_no_delete    before delete on public.audit_logs    for each row execute function public.forbid_delete();
create trigger subscribers_no_delete   before delete on public.subscribers   for each row execute function public.forbid_delete();

create trigger subscriptions_void_only before update on public.subscriptions for each row execute function public.financial_row_void_only();
create trigger payments_void_only      before update on public.payments      for each row execute function public.financial_row_void_only();
create trigger expenses_void_only      before update on public.expenses      for each row execute function public.financial_row_void_only();
create trigger renewals_no_update      before update on public.renewals      for each row execute function public.forbid_update();
create trigger audit_logs_no_update    before update on public.audit_logs    for each row execute function public.forbid_update();

-- ---------------------------------------------------------------------
-- Subscriber balance cache: recomputed from source rows (never += math),
-- so a payment can never be counted twice.
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
        where subscriber_id = p_subscriber_id and not is_voided), 0),
      total_paid = coalesce((
        select sum(amount) from public.payments
        where subscriber_id = p_subscriber_id and not is_voided), 0)
  where s.id = p_subscriber_id
$$;

create or replace function public.trg_recompute_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_subscriber_balance(new.subscriber_id);
  return null;
end;
$$;

create trigger subscriptions_recompute_balance
  after insert or update on public.subscriptions
  for each row execute function public.trg_recompute_balance();
create trigger payments_recompute_balance
  after insert or update on public.payments
  for each row execute function public.trg_recompute_balance();

-- ---------------------------------------------------------------------
-- Subscriber access for the current user (collector sees assigned only).
-- ---------------------------------------------------------------------
create or replace function public.can_access_subscriber(p_subscriber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_staff_role()
    when 'admin' then true
    when 'employee' then true
    when 'collector' then exists (
      select 1 from public.subscribers s
      where s.id = p_subscriber_id and s.collector_id = auth.uid())
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.towers        enable row level security;
alter table public.packages      enable row level security;
alter table public.subscribers   enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;
alter table public.renewals      enable row level security;
alter table public.expenses      enable row level security;
alter table public.audit_logs    enable row level security;

-- profiles: any active staff can read (names on receipts, collector lists);
-- only admins create/modify.
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_staff() or id = (select auth.uid()));
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- towers & packages: staff read, admin write.
create policy towers_select on public.towers
  for select to authenticated using (public.is_staff());
create policy towers_insert on public.towers
  for insert to authenticated with check (public.is_admin());
create policy towers_update on public.towers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy packages_select on public.packages
  for select to authenticated using (public.is_staff());
create policy packages_insert on public.packages
  for insert to authenticated with check (public.is_admin());
create policy packages_update on public.packages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- subscribers: admin/employee see all, collector sees assigned.
-- Inserts go through create_subscriber() (adds first period + payment).
create policy subscribers_select on public.subscribers
  for select to authenticated
  using (
    public.current_staff_role() in ('admin', 'employee')
    or (public.current_staff_role() = 'collector' and collector_id = (select auth.uid()))
  );
create policy subscribers_update on public.subscribers
  for update to authenticated
  using (public.has_permission('edit_subscribers'))
  with check (public.has_permission('edit_subscribers'));

-- financial tables: read-only to clients, scoped by subscriber access.
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (public.can_access_subscriber(subscriber_id));
create policy renewals_select on public.renewals
  for select to authenticated using (public.can_access_subscriber(subscriber_id));
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.current_staff_role() in ('admin', 'employee')
    or received_by = (select auth.uid())
    or public.can_access_subscriber(subscriber_id)
  );

-- expenses: finance viewers read; admin records.
create policy expenses_select on public.expenses
  for select to authenticated using (public.has_permission('view_finance'));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()) and not is_voided);

-- audit: admin read only.
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Privileges: nothing for anon. Authenticated gets table privileges
-- (filtered by RLS above). Internal trigger/helper functions are not
-- callable over the API.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, authenticated, public;

grant select, insert, update on all tables in schema public to authenticated;
revoke insert, update on public.audit_logs, public.renewals, public.payments,
  public.subscriptions from authenticated;
revoke update on public.expenses from authenticated;
revoke delete, truncate on all tables in schema public from authenticated;
grant usage on all sequences in schema public to authenticated;

grant execute on function
  public.today_baghdad(),
  public.normalize_ar(text),
  public.current_staff_role(),
  public.is_staff(),
  public.is_admin(),
  public.has_permission(text),
  public.can_access_subscriber(uuid)
to authenticated;

-- Future functions in public are not executable by anon/public by default.
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
