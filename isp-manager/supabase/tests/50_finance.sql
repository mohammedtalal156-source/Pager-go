-- Phase 5 tests: finance summary, reports, expense voids.
\set QUIET on
\o /dev/null
set client_min_messages = warning;
begin;
create schema tests;
grant usage on schema tests to public;
create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; raise warning 'ok - %', msg; end $$;
create function tests.throws(q text, msg text, state text default null) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if state is not null and sqlstate <> state then
      raise exception 'FAIL: % (expected %, got %: %)', msg, state, sqlstate, sqlerrm; end if;
    raise warning 'ok - % [%]', msg, sqlstate; return;
  end;
  raise exception 'FAIL: % (statement succeeded)', msg;
end $$;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, username, full_name, role, can_view_finance) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', true),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee', false),
  ('00000000-0000-0000-0000-00000000000d', 'acc', 'محاسب', 'employee', true);
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ'), ('10000000-0000-0000-0000-000000000002', 'برج ب');
insert into public.subscribers (id, full_name, phone, tower_id, price) values
  ('30000000-0000-0000-0000-000000000001', 'مشترك أ', '07700000001', '10000000-0000-0000-0000-000000000001', 25000),
  ('30000000-0000-0000-0000-000000000002', 'مشترك ب', '07700000002', '10000000-0000-0000-0000-000000000002', 30000);
insert into public.subscriptions (subscriber_id, tower_id, kind, start_date, end_date, price) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'new', current_date, current_date + 30, 25000),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'new', current_date, current_date + 30, 30000);
insert into public.payments (subscriber_id, tower_id, kind, amount, received_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'new_subscription', 25000, '00000000-0000-0000-0000-00000000000e'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'new_subscription', 10000, '00000000-0000-0000-0000-00000000000a');
insert into public.payments (subscriber_id, tower_id, kind, amount, received_by, is_voided, voided_at, void_reason) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'collection', 9999, '00000000-0000-0000-0000-00000000000a', true, now(), 'خطأ');
insert into public.expenses (category, amount, expense_date, tower_id, created_by) values
  ('electricity', 8000, public.today_baghdad(), '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('salaries', 5000, public.today_baghdad(), null, '00000000-0000-0000-0000-00000000000a'),
  ('rent', 777, public.today_baghdad() - 400, null, '00000000-0000-0000-0000-00000000000a');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
create temp table f on commit drop as select public.finance_summary(public.today_baghdad() - 6, public.today_baghdad()) as j;
select tests.ok((select (j->>'collected')::int from f) = 35000, 'finance: collected = non-voided payments only (35,000)');
select tests.ok((select (j->>'expenses')::int from f) = 13000, 'finance: expenses in period (13,000)');
select tests.ok((select (j->>'net')::int from f) = 22000, 'finance: net cash flow 35,000 - 13,000');
select tests.ok((select (j->>'debt')::int from f) = 20000, 'finance: debt is reported separately, not as revenue');
select tests.ok((select json_array_length(j->'daily') from f) = 7, 'finance: one row per day');
select tests.ok((select (j->'expenses_by_category'->>'electricity')::int from f) = 8000, 'finance: expenses by category');
select tests.ok((public.finance_summary(public.today_baghdad(), public.today_baghdad(), '10000000-0000-0000-0000-000000000001')->>'net')::int = 17000,
  'finance per tower: 25,000 - 8,000 (general expenses excluded)');
create temp table rt on commit drop as select * from public.report_towers(public.today_baghdad() - 30, public.today_baghdad());
select tests.ok((select collected from rt where tower_name = 'برج ب') = 10000, 'tower report: collected per tower');
select tests.ok((select debt from rt where tower_name = 'برج ب') = 20000, 'tower report: debt per tower');
create temp table rc on commit drop as select * from public.report_collectors(public.today_baghdad() - 30, public.today_baghdad());
select tests.ok((select collected from rc where staff_name = 'موظف') = 25000, 'collector report: per staff');
select tests.ok((select count(*) from rc) = 2, 'collector report: voided payments excluded');
select tests.throws($$select public.void_expense((select id from public.expenses where amount = 8000), 'خطأ')$$, 'void expense: non-admin rejected', '42501');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.ok((public.finance_summary(public.today_baghdad() - 6, public.today_baghdad())->>'expenses')::int = 0,
  'finance: employee without finance permission cannot see expenses');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.void_expense((select id from public.expenses where amount = 8000), 'مكرر');
select tests.ok((public.finance_summary(public.today_baghdad(), public.today_baghdad())->>'expenses')::int = 5000, 'void expense: excluded from totals');
reset role;
rollback;
