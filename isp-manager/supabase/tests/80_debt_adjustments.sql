-- Phase 9 tests: manual debt adjustments.
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
create table tests.ids (k text primary key, v uuid);
create table tests.vars (k text primary key, v jsonb);
grant all on tests.ids, tests.vars to public;
create function tests.id(k text) returns uuid language sql stable as $$ select v from tests.ids where ids.k = id.k $$;
create function tests.bal() returns bigint language sql stable security definer as $$
  select balance from public.subscribers where id = (select v from tests.ids where k = 's') $$;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, full_name, role, can_edit_subscribers, can_view_finance) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', true, true),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee', true, true),
  ('00000000-0000-0000-0000-00000000000c', 'col', 'جابي', 'collector', false, false);
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 35', 35000, 30);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
insert into tests.ids select 's', (public.create_subscriber(
  p_full_name => 'حسين علي', p_phone => '07701234567', p_tower_id => '10000000-0000-0000-0000-000000000001',
  p_package_id => '20000000-0000-0000-0000-000000000001', p_price => 35000,
  p_start_date => public.today_baghdad() - 5, p_amount_paid => 0) ->> 'id')::uuid;
reset role;
select tests.ok(tests.bal() = 35000, 'setup: debt 35,000');

-- ---------------- permissions & direct writes ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.adjust_debt(tests.id('s'), 70000, 35000, 'زيادة')$$, 'employee cannot adjust debt', '42501');
select tests.throws($$insert into public.debt_adjustments (subscriber_id, amount, previous_balance, new_balance, reason, created_by)
  values (tests.id('s'), 1, 35000, 35001, 'مباشر', '00000000-0000-0000-0000-00000000000e')$$, 'no direct insert into adjustments', '42501');
select tests.throws($$update public.subscribers set total_due = 70000 where id = tests.id('s')$$, 'no direct edit of the computed debt', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.throws($$select public.adjust_debt(tests.id('s'), 70000, 35000, 'زيادة')$$, 'collector cannot adjust debt', '42501');
reset role;

-- ---------------- validation ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.adjust_debt(tests.id('s'), 70000, 35000, 'ab')$$, 'reason required', 'P0001');
select tests.throws($$select public.adjust_debt(tests.id('s'), -1, 35000, 'سالب')$$, 'negative debt rejected', 'P0001');
select tests.throws($$select public.adjust_debt(tests.id('s'), 35000, 35000, 'نفس المبلغ')$$, 'same amount rejected', 'P0001');
select tests.throws($$select public.adjust_debt(tests.id('s'), 70000, 30000, 'رصيد قديم')$$, 'stale expected balance rejected (concurrent change)', 'P0001');

-- ---------------- the user's example: 35,000 → 70,000 ----------------
insert into tests.vars select 'up', public.adjust_debt(tests.id('s'), 70000, 35000, 'دين سابق غير مسجل', '93000000-0000-0000-0000-000000000001')::jsonb;
select tests.ok((select (v->>'amount')::int = 35000 and (v->>'balance')::int = 70000 from tests.vars where k = 'up'), 'increase: +35,000 adjustment, debt 70,000');
select tests.ok((public.adjust_debt(tests.id('s'), 70000, 35000, 'دين سابق غير مسجل', '93000000-0000-0000-0000-000000000001')->>'duplicate')::boolean,
  'increase: double click returns the first result');
reset role;
select tests.ok(tests.bal() = 70000, 'increase: subscriber balance 70,000');
select tests.ok((select count(*) from public.debt_adjustments) = 1, 'increase: one adjustment row (not counted twice)');
select tests.ok((select previous_balance = 35000 and new_balance = 70000 and amount = 35000 and reason = 'دين سابق غير مسجل'
  and created_by = '00000000-0000-0000-0000-00000000000a' and created_at is not null from public.debt_adjustments),
  'increase: row keeps previous, new, difference, reason, admin and time');
select tests.ok((select count(*) from public.payments where subscriber_id = tests.id('s')) = 0, 'increase: no payment created');
select tests.ok((select balance from public.subscriber_overview where id = tests.id('s')) = 70000, 'increase: shows in subscriber list/overview');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.finance_summary(public.today_baghdad() - 30, public.today_baghdad())->>'collected')::int = 0, 'increase: not revenue');
select tests.ok((public.finance_summary(public.today_baghdad() - 30, public.today_baghdad())->>'debt')::int = 70000, 'increase: finance debt 70,000');
select tests.ok((public.dashboard_stats()->>'debt')::int = 70000, 'increase: dashboard debt 70,000');
select tests.ok((select debt from public.report_towers(public.today_baghdad() - 30, public.today_baghdad())) = 70000, 'increase: tower report debt 70,000');

-- ---------------- decrease: 70,000 → 20,000 ----------------
insert into tests.vars select 'down', public.adjust_debt(tests.id('s'), 20000, 70000, 'خصم متفق عليه')::jsonb;
select tests.ok((select (v->>'amount')::int = -50000 from tests.vars where k = 'down'), 'decrease: -50,000 adjustment');
reset role;
select tests.ok(tests.bal() = 20000, 'decrease: debt 20,000');
select tests.ok((select total_paid from public.subscribers where id = tests.id('s')) = 0, 'decrease: nothing counted as paid');

-- ---------------- later payment, renewal and correction keep working ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select public.record_payment(tests.id('s'), 5000);
reset role;
select tests.ok(tests.bal() = 15000, 'payment after adjustment: 20,000 - 5,000 = 15,000');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.record_payment(tests.id('s'), 15001)$$, 'payment cannot exceed adjusted debt', 'P0001');
select public.renew_subscription(tests.id('s'), 1, 35000, 10000);
reset role;
select tests.ok(tests.bal() = 40000, 'renewal after adjustment: 15,000 + 35,000 - 10,000 = 40,000');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.correct_payment((select id from public.payments where amount = 5000), 6000, 'كان 6 آلاف');
reset role;
select tests.ok(tests.bal() = 39000, 'correction after adjustment: 39,000');
select tests.ok((select count(*) from public.debt_adjustments) = 2, 'adjustments untouched by later operations');
select tests.ok((select total_due - total_paid from public.subscribers where id = tests.id('s'))
  = (select sum(price) from public.subscriptions where subscriber_id = tests.id('s') and not is_voided)
  + (select sum(amount) from public.debt_adjustments where subscriber_id = tests.id('s'))
  - (select sum(amount) from public.payments where subscriber_id = tests.id('s') and not is_voided),
  'balance always = periods + adjustments - payments');

-- ---------------- to zero, never below ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.adjust_debt(tests.id('s'), 0, 39000, 'إعفاء');
select tests.throws($$select public.adjust_debt(tests.id('s'), -1000, 0, 'سالب')$$, 'cannot go below zero', 'P0001');
select tests.throws($$select public.void_renewal((select id from public.renewals limit 1), 'إلغاء')$$,
  'void renewal refused when adjustments would make the amount due negative', 'P0001');
reset role;
select tests.ok(tests.bal() = 0, 'zero: debt 0');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.record_payment(tests.id('s'), 1)$$, 'zero: no payment possible on zero debt', 'P0001');
-- employee may read the adjustments of a subscriber they can see
select tests.ok((select count(*) from public.debt_adjustments) = 3, 'employee can read adjustments');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.ok((select count(*) from public.debt_adjustments) = 0, 'unassigned collector cannot read adjustments');
reset role;
select tests.throws($$update public.debt_adjustments set amount = 1$$, 'adjustments cannot be edited (any role)', '42501');
select tests.throws($$delete from public.debt_adjustments$$, 'adjustments cannot be deleted (any role)', '42501');

-- ---------------- audit, history, backup ----------------
select tests.ok((select count(*) from public.audit_logs where table_name = 'debt_adjustments' and action = 'INSERT') = 3, 'audit: every adjustment logged');
select tests.ok(exists (select 1 from public.audit_logs where table_name = 'debt_adjustments' and reason like 'تعديل الدين من 35000 إلى 70000%'),
  'audit: reason with old and new debt');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((select count(*) from public.subscriber_history(tests.id('s')) where table_name = 'debt_adjustments') = 3, 'history shows adjustments');
select tests.ok(jsonb_array_length(public.export_backup()->'debt_adjustments') = 3, 'backup includes adjustments');
reset role;
rollback;
