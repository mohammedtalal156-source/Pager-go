-- Phases 3–4 tests: create / renew / collect / void, permissions, idempotency.
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
grant all on tests.ids to public;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000f'),
  ('00000000-0000-0000-0000-000000000003');
insert into public.profiles (id, username, full_name, role, can_renew, can_collect) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', true, true),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee', true, true),
  ('00000000-0000-0000-0000-00000000000c', 'col1', 'محصل أول', 'collector', false, true),
  ('00000000-0000-0000-0000-00000000000f', 'col2', 'محصل ثاني', 'collector', false, true),
  ('00000000-0000-0000-0000-000000000003', 'norenew', 'موظف بلا تجديد', 'employee', false, false);
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30);

-- ---------------- create_subscriber (as employee) ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
insert into tests.ids select 's1', (public.create_subscriber(
  p_full_name => 'أحمد محمد', p_phone => '07701234567', p_tower_id => '10000000-0000-0000-0000-000000000001',
  p_package_id => '20000000-0000-0000-0000-000000000001', p_price => 25000,
  p_start_date => public.today_baghdad() - 10, p_amount_paid => 15000,
  p_collector_id => '00000000-0000-0000-0000-00000000000c',
  p_request_id => '90000000-0000-0000-0000-000000000001') ->> 'id')::uuid;
select tests.ok((select (public.create_subscriber(p_full_name => 'أحمد محمد', p_phone => '07701234567',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000, p_start_date => public.today_baghdad(),
  p_amount_paid => 15000, p_request_id => '90000000-0000-0000-0000-000000000001') ->> 'duplicate')::boolean),
  'create: same request_id returns the existing subscriber (double click)');
reset role;
select tests.ok((select count(*) from public.subscribers) = 1, 'create: only one subscriber row');
select tests.ok((select count(*) from public.payments) = 1, 'create: only one payment row');
select tests.ok((select balance from public.subscribers where id = (select v from tests.ids where k='s1')) = 10000,
  'create: 25,000 price - 15,000 paid = 10,000 debt');
select tests.ok((select end_date - start_date from public.subscribers where id = (select v from tests.ids where k='s1')) = 30,
  'create: end date = start + package duration');
select tests.ok((select created_by from public.subscribers where id = (select v from tests.ids where k='s1')) = '00000000-0000-0000-0000-00000000000e',
  'create: created_by is the employee');

set role authenticated;
select tests.throws($$select public.create_subscriber(p_full_name => 'زيد', p_phone => '07700000000',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000, p_start_date => current_date, p_amount_paid => 30000)$$,
  'create: paid more than price rejected', 'P0001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select tests.throws($$select public.create_subscriber(p_full_name => 'زيد', p_phone => '07700000000',
  p_tower_id => '10000000-0000-0000-0000-000000000001')$$, 'create: collector cannot add subscribers', '42501');
reset role;

-- ---------------- renew_subscription ----------------
-- s1 is active (end = today+20). Renewing 1 period extends from current end.
create temp table r1 on commit drop as select null::json as j;
grant all on r1 to public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
update r1 set j = public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 25000,
  null, null, '90000000-0000-0000-0000-000000000002');
reset role;
select tests.ok((select (j->>'end_date')::date from r1) = public.today_baghdad() + 20 + 30, 'renew active: +30 days from current end date');
select tests.ok((select (j->>'start_date')::date from r1) = public.today_baghdad() + 21, 'renew active: new period starts day after old end');
select tests.ok((select (j->>'balance')::int from r1) = 10000, 'renew: paid in full keeps old debt 10,000');
select tests.ok((select count(*) from public.renewals) = 1, 'renew: renewal logged');
select tests.ok((select count(*) from public.payments where kind = 'renewal') = 1, 'renew: payment recorded');

set role authenticated;
select tests.ok((public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 25000,
  null, null, '90000000-0000-0000-0000-000000000002') ->> 'duplicate')::boolean, 'renew: same request_id is not applied twice');
reset role;
select tests.ok((select count(*) from public.renewals) = 1 and (select count(*) from public.payments where kind = 'renewal') = 1,
  'renew: still one renewal and one payment after double click');
select tests.ok((select end_date from public.subscribers where id = (select v from tests.ids where k='s1')) = public.today_baghdad() + 50,
  'renew: end date not extended twice');

set role authenticated;
select tests.throws($$select public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 40000)$$,
  'renew: received more than due (35,000) rejected', 'P0001');
select tests.throws($$select public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 0, null, '2026-01-01')$$,
  'renew: employee cannot override start date', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select tests.throws($$select public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 0)$$,
  'renew: employee without renew permission rejected', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select tests.throws($$select public.renew_subscription((select v from tests.ids where k='s1'), 1, 25000, 0)$$,
  'renew: collector cannot renew', '42501');
reset role;

-- Expired subscriber renews from today
insert into public.subscribers (id, full_name, phone, tower_id, package_id, price, collector_id)
values ('30000000-0000-0000-0000-000000000002', 'فاطمة علي', '07801234567', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001', 25000, null);
update public.subscribers set start_date = public.today_baghdad() - 40, end_date = public.today_baghdad() - 10
where id = '30000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.ok((public.renew_subscription('30000000-0000-0000-0000-000000000002', 2, 50000, 30000) ->> 'start_date')::date = public.today_baghdad(),
  'renew expired: starts today');
reset role;
select tests.ok((select end_date from public.subscribers where id = '30000000-0000-0000-0000-000000000002') = public.today_baghdad() + 60,
  'renew expired 2 periods: today + 60 days');
select tests.ok((select balance from public.subscribers where id = '30000000-0000-0000-0000-000000000002') = 20000,
  'renew partial: 50,000 - 30,000 = 20,000 debt');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.renew_subscription('30000000-0000-0000-0000-000000000002', 1, 25000, 0, null,
  public.today_baghdad() + 100) ->> 'end_date')::date = public.today_baghdad() + 130, 'renew: admin start-date override');
reset role;
select tests.ok((select date_overridden from public.renewals order by seq desc limit 1), 'renew: override flagged in log');

-- ---------------- record_payment ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.ok((public.record_payment((select v from tests.ids where k='s1'), 4000, 'دفعة جزئية',
  '90000000-0000-0000-0000-000000000003') ->> 'balance')::int = 6000, 'collect: assigned collector, partial 4,000 -> 6,000');
select tests.ok((public.record_payment((select v from tests.ids where k='s1'), 4000, null,
  '90000000-0000-0000-0000-000000000003') ->> 'duplicate')::boolean, 'collect: same request_id not counted twice');
select tests.throws($$select public.record_payment((select v from tests.ids where k='s1'), 7000)$$,
  'collect: more than remaining debt rejected', 'P0001');
select tests.throws($$select public.record_payment('30000000-0000-0000-0000-000000000002', 1000)$$,
  'collect: collector cannot collect from unassigned subscriber', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select tests.throws($$select public.record_payment((select v from tests.ids where k='s1'), 1000)$$,
  'collect: other collector rejected', '42501');
reset role;
select tests.ok((select balance from public.subscribers where id = (select v from tests.ids where k='s1')) = 6000, 'collect: balance 6,000');
select tests.ok((select received_by from public.payments where request_id = '90000000-0000-0000-0000-000000000003') = '00000000-0000-0000-0000-00000000000c',
  'collect: received_by is the collector');
select tests.ok(
  (select total_paid from public.subscribers where id = (select v from tests.ids where k='s1'))
  = (select sum(amount) from public.payments where subscriber_id = (select v from tests.ids where k='s1') and not is_voided),
  'no double counting: total_paid = sum of payments');

-- ---------------- voids (admin) ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.void_payment((select id from public.payments where request_id = '90000000-0000-0000-0000-000000000003'), 'خطأ')$$,
  'void: employee cannot void payments', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select tests.throws($$select public.void_payment((select id from public.payments where request_id = '90000000-0000-0000-0000-000000000003'), '')$$,
  'void: reason required', 'P0001');
select tests.ok((public.void_payment((select id from public.payments where request_id = '90000000-0000-0000-0000-000000000003'),
  'المبلغ سُجل بالخطأ') ->> 'balance')::int = 10000, 'void payment: debt back to 10,000');
reset role;
select tests.ok((select reason from public.audit_logs where table_name = 'payments' and action = 'UPDATE' order by id desc limit 1) = 'المبلغ سُجل بالخطأ',
  'void: reason stored in audit log');

-- void latest renewal of subscriber 2 (the override one) restores previous end
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.void_renewal((select id from public.renewals where subscriber_id = '30000000-0000-0000-0000-000000000002' order by seq asc limit 1), 'خطأ تجديد')$$,
  'void renewal: only the latest renewal can be voided', 'P0001');
select tests.ok((public.void_renewal((select id from public.renewals where subscriber_id = '30000000-0000-0000-0000-000000000002' order by seq desc limit 1),
  'تاريخ خاطئ') ->> 'end_date')::date = public.today_baghdad() + 60, 'void renewal: end date restored');
select public.set_subscriber_dates('30000000-0000-0000-0000-000000000002', public.today_baghdad(), public.today_baghdad() + 61, 'تصحيح يدوي');
reset role;
select tests.ok((select end_date from public.subscribers where id = '30000000-0000-0000-0000-000000000002') = public.today_baghdad() + 61, 'admin can correct dates');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.set_subscriber_dates('30000000-0000-0000-0000-000000000002', null, null, 'محاولة')$$,
  'employee cannot correct dates', '42501');
select tests.ok((select count(*) from public.list_collectors()) = 3, 'collectors list: 2 collectors + 1 employee who can collect');
reset role;
set role anon;
select tests.throws($$select public.record_payment('30000000-0000-0000-0000-000000000002', 1)$$, 'anon cannot call operations', '42501');
reset role;
rollback;
