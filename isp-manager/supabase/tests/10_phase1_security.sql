-- Phase 1 tests: roles, RLS, permissions, balances, immutability, audit.
-- Runs as superuser; switches to the `authenticated` role with a JWT sub
-- to simulate each staff member exactly like PostgREST does.
\set QUIET on
\o /dev/null
set client_min_messages = warning;
begin;

create schema tests;
grant usage on schema tests to public;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise warning 'ok - %', msg;
end $$;

-- Executes `q` and asserts it fails (optionally with a given SQLSTATE).
create function tests.throws(q text, msg text, state text default null) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if state is not null and sqlstate <> state then
      raise exception 'FAIL: % (expected %, got %: %)', msg, state, sqlstate, sqlerrm;
    end if;
    raise warning 'ok - % [%]', msg, sqlstate;
    return;
  end;
  raise exception 'FAIL: % (statement succeeded)', msg;
end $$;

create function tests.cnt(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'with x as (' || q || ') select count(*) from x' into n;
  return n;
end $$;

grant execute on all functions in schema tests to public;

-- Fixed ids --------------------------------------------------------------
-- a = admin, e = employee (defaults), d = employee with edit+finance,
-- c = collector 1, f = collector 2, i = inactive employee, n = no profile
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@staff.local'),
  ('00000000-0000-0000-0000-00000000000e', 'emp@staff.local'),
  ('00000000-0000-0000-0000-00000000000d', 'emp2@staff.local'),
  ('00000000-0000-0000-0000-00000000000c', 'col1@staff.local'),
  ('00000000-0000-0000-0000-00000000000f', 'col2@staff.local'),
  ('00000000-0000-0000-0000-000000000001', 'inactive@staff.local'),
  ('00000000-0000-0000-0000-000000000002', 'stranger@example.com');

insert into public.profiles (id, username, full_name, role, is_active, can_edit_subscribers, can_view_finance) values
  ('00000000-0000-0000-0000-00000000000a', 'admin',    'المدير',        'admin',     true,  false, false),
  ('00000000-0000-0000-0000-00000000000e', 'emp',      'موظف أول',      'employee',  true,  false, false),
  ('00000000-0000-0000-0000-00000000000d', 'emp2',     'موظف ثاني',     'employee',  true,  true,  true),
  ('00000000-0000-0000-0000-00000000000c', 'col1',     'محصل أول',      'collector', true,  false, false),
  ('00000000-0000-0000-0000-00000000000f', 'col2',     'محصل ثاني',     'collector', true,  false, false),
  ('00000000-0000-0000-0000-000000000001', 'inactive', 'موظف موقوف',    'employee',  false, true,  true);

insert into public.towers (id, name, area) values
  ('10000000-0000-0000-0000-000000000001', 'برج الكرادة', 'الكرادة');
insert into public.packages (id, name, price, duration_days) values
  ('20000000-0000-0000-0000-000000000001', 'باقة 25 ألف', 25000, 30);
insert into public.subscribers (id, full_name, phone, tower_id, package_id, price, collector_id) values
  ('30000000-0000-0000-0000-000000000001', 'أحمد محمد',   '07701234567', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 25000, '00000000-0000-0000-0000-00000000000c'),
  ('30000000-0000-0000-0000-000000000002', 'فاطمة علي',   '07809876543', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 25000, null);

-- ------------------------------------------------------------------------
-- Helpers & normalisation
-- ------------------------------------------------------------------------
select tests.ok(public.normalize_ar('أحمد') = 'احمد', 'normalize: hamza alef');
select tests.ok(public.normalize_ar('فاطمة') = 'فاطمه', 'normalize: taa marbuta');
select tests.ok(public.normalize_ar('مُحَمَّد') = 'محمد', 'normalize: harakat removed');
select tests.ok(public.normalize_ar('٠٧٧٠١٢') = '077012', 'normalize: Arabic-Indic digits');
select tests.ok((select code from public.subscribers where id = '30000000-0000-0000-0000-000000000001') >= 1001,
  'subscriber code generated automatically');
select tests.ok(
  (select count(*) from public.subscribers where search_text like '%' || public.normalize_ar('احمد') || '%') = 1,
  'search_text matches normalised name');
select tests.ok(
  (select count(*) from public.subscribers where search_text like '%' || public.normalize_ar('٠٧٧٠١') || '%') = 1,
  'search_text matches phone typed with Arabic digits');
select tests.throws($$insert into public.subscribers (full_name, phone, tower_id) values ('x y', 'abc', '10000000-0000-0000-0000-000000000001')$$,
  'invalid phone rejected', '23514');

-- ------------------------------------------------------------------------
-- Financial ledger (inserted as superuser here; app uses RPCs in phase 4)
-- ------------------------------------------------------------------------
insert into public.subscriptions (id, subscriber_id, tower_id, package_id, kind, start_date, end_date, price, created_by) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'new', current_date, current_date + 30, 25000, '00000000-0000-0000-0000-00000000000e');
insert into public.payments (id, subscriber_id, tower_id, subscription_id, kind, amount, received_by, request_id) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 'new_subscription', 15000, '00000000-0000-0000-0000-00000000000e',
   '60000000-0000-0000-0000-000000000001');

select tests.ok((select balance from public.subscribers where id = '30000000-0000-0000-0000-000000000001') = 10000,
  'price 25,000 - paid 15,000 = debt 10,000');

select tests.throws($$insert into public.payments (subscriber_id, tower_id, kind, amount, received_by, request_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'collection', 10000,
   '00000000-0000-0000-0000-00000000000e', '60000000-0000-0000-0000-000000000001')$$,
  'same request_id cannot be recorded twice (double click)', '23505');

insert into public.payments (id, subscriber_id, tower_id, kind, amount, received_by) values
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'collection', 4000, '00000000-0000-0000-0000-00000000000c');
select tests.ok((select balance from public.subscribers where id = '30000000-0000-0000-0000-000000000001') = 6000,
  'partial collection 4,000 -> debt 6,000');

select tests.throws($$insert into public.payments (subscriber_id, tower_id, kind, amount, received_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'collection', 0,
   '00000000-0000-0000-0000-00000000000c')$$, 'zero payment rejected', '23514');

-- Immutability (even for the table owner / service role)
select tests.throws($$delete from public.payments where id = '50000000-0000-0000-0000-000000000002'$$,
  'payments cannot be deleted, even by superuser', '42501');
select tests.throws($$update public.payments set amount = 1 where id = '50000000-0000-0000-0000-000000000002'$$,
  'payment amount cannot be edited', '42501');
select tests.throws($$update public.payments set is_voided = true, voided_at = now() where id = '50000000-0000-0000-0000-000000000002'$$,
  'void requires a reason', '23514');
select tests.throws($$delete from public.subscribers where id = '30000000-0000-0000-0000-000000000001'$$,
  'subscribers are archived, never deleted', '42501');

update public.payments set is_voided = true, voided_at = now(), voided_by = '00000000-0000-0000-0000-00000000000a',
  void_reason = 'خطأ في الإدخال' where id = '50000000-0000-0000-0000-000000000002';
select tests.ok((select balance from public.subscribers where id = '30000000-0000-0000-0000-000000000001') = 10000,
  'voided payment no longer counts -> debt back to 10,000');
select tests.throws($$update public.payments set void_reason = 'تغيير' where id = '50000000-0000-0000-0000-000000000002'$$,
  'voided payment is frozen', '42501');
select tests.ok(
  (select count(*) from public.audit_logs where table_name = 'payments' and record_id = '50000000-0000-0000-0000-000000000002' and action = 'UPDATE') = 1,
  'void is recorded in audit_logs');

-- ------------------------------------------------------------------------
-- RLS per role
-- ------------------------------------------------------------------------
-- anon: nothing
set role anon;
select tests.throws('select * from public.subscribers', 'anon cannot read subscribers', '42501');
select tests.throws('select * from public.profiles', 'anon cannot read profiles', '42501');
reset role;

-- authenticated user with no profile (e.g. if public sign-up were ever on)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 0, 'user without profile sees no subscribers');
select tests.ok(tests.cnt('select 1 from public.towers') = 0, 'user without profile sees no towers');
select tests.ok(tests.cnt('select 1 from public.payments') = 0, 'user without profile sees no payments');
select tests.ok(not public.is_staff(), 'user without profile is not staff');
reset role;

-- inactive employee
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 0, 'deactivated employee sees nothing');
select tests.ok(not public.has_permission('edit_subscribers'), 'deactivated employee has no permissions');
reset role;

-- employee with default permissions
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 2, 'employee sees all subscribers');
select tests.ok(tests.cnt('select 1 from public.payments') = 2, 'employee sees payments');
select tests.ok(public.has_permission('renew') and public.has_permission('collect'), 'employee can renew & collect by default');
select tests.ok(not public.has_permission('view_finance'), 'employee has no finance access by default');
select tests.ok(tests.cnt('select 1 from public.expenses') = 0, 'employee cannot read expenses');
select tests.ok(tests.cnt('select 1 from public.audit_logs') = 0, 'employee cannot read audit log');
select tests.throws($$insert into public.towers (name) values ('برج جديد')$$, 'employee cannot add towers', '42501');
select tests.throws($$insert into public.packages (name, price) values ('x', 1)$$, 'employee cannot add packages', '42501');
select tests.throws($$insert into public.subscribers (full_name, phone, tower_id) values ('مشترك', '07700000000', '10000000-0000-0000-0000-000000000001')$$,
  'direct subscriber insert blocked (must use RPC)', '42501');
select tests.throws($$insert into public.payments (subscriber_id, tower_id, kind, amount, received_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'collection', 1000, '00000000-0000-0000-0000-00000000000e')$$,
  'direct payment insert blocked (must use RPC)', '42501');
select tests.throws($$delete from public.payments$$, 'employee cannot delete payments', '42501');
select tests.ok(tests.cnt($$update public.subscribers set notes = 'x' returning 1$$) = 0,
  'employee without edit permission cannot update subscribers');
select tests.ok(tests.cnt($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e' returning 1$$) = 0,
  'employee cannot promote self to admin');
select tests.ok(public.current_staff_role() = 'employee', 'role unchanged after escalation attempt');
select tests.throws($$insert into public.expenses (category, amount) values ('rent', 1000)$$, 'employee cannot record expenses', '42501');
reset role;

-- employee with edit + finance permissions
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
select tests.ok(tests.cnt($$update public.subscribers set notes = 'بجانب الجامع' where id = '30000000-0000-0000-0000-000000000002' returning 1$$) = 1,
  'employee with edit permission can update subscriber details');
select tests.throws($$update public.subscribers set end_date = current_date + 365 where id = '30000000-0000-0000-0000-000000000002'$$,
  'cannot extend subscription by editing end_date directly', '42501');
select tests.throws($$update public.subscribers set total_paid = 999999 where id = '30000000-0000-0000-0000-000000000001'$$,
  'cannot change balance directly', '42501');
select tests.ok(public.has_permission('view_finance'), 'finance permission granted by admin works');
reset role;

-- collector 1: only assigned subscriber
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 1, 'collector sees only assigned subscriber');
select tests.ok(tests.cnt($$select 1 from public.subscribers where id = '30000000-0000-0000-0000-000000000002'$$) = 0,
  'collector cannot see unassigned subscriber');
select tests.ok(tests.cnt('select 1 from public.payments') = 2, 'collector sees payments of assigned subscriber');
select tests.ok(tests.cnt('select 1 from public.subscriptions') = 1, 'collector sees subscription of assigned subscriber');
select tests.ok(not public.has_permission('renew'), 'collector cannot renew');
select tests.ok(public.has_permission('collect'), 'collector can collect');
select tests.ok(tests.cnt($$update public.subscribers set notes = 'x' returning 1$$) = 0, 'collector cannot edit subscribers');
reset role;

-- collector 2: nothing assigned
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 0, 'collector 2 sees no subscribers');
select tests.ok(tests.cnt('select 1 from public.payments') = 0, 'collector 2 sees no payments');
reset role;

-- admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok(tests.cnt('select 1 from public.subscribers') = 2, 'admin sees all subscribers');
select tests.ok(tests.cnt('select 1 from public.audit_logs') > 0, 'admin can read audit log');
insert into public.towers (name, area) values ('برج المنصور', 'المنصور');
select tests.ok(tests.cnt($$select 1 from public.towers where name = 'برج المنصور'$$) = 1, 'admin can add tower');
select tests.throws($$insert into public.towers (name) values ('برج المنصور')$$, 'duplicate active tower name rejected', '23505');
insert into public.expenses (category, amount, description) values ('electricity', 50000, 'مولدة');
select tests.ok(tests.cnt('select 1 from public.expenses') = 1, 'admin can record expense');
select tests.throws($$update public.expenses set amount = 1$$, 'admin cannot silently edit an expense', '42501');
select tests.throws($$update public.audit_logs set reason = 'x'$$, 'audit log is append-only', '42501');
select tests.ok(tests.cnt($$update public.profiles set can_edit_subscribers = true where id = '00000000-0000-0000-0000-00000000000e' returning 1$$) = 1,
  'admin can change employee permissions');
select tests.throws($$update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000a'$$,
  'last active admin cannot be deactivated', 'P0001');
select tests.throws($$select public.recompute_subscriber_balance('30000000-0000-0000-0000-000000000001')$$,
  'internal functions are not callable by clients', '42501');
reset role;

select tests.ok(
  (select count(*) from public.audit_logs where table_name = 'profiles' and action = 'UPDATE'
     and actor_id = '00000000-0000-0000-0000-00000000000a') = 1,
  'permission change is audited with the admin as actor');

rollback;
