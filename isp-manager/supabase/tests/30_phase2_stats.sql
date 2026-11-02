-- Phase 2 tests: status view, dashboard and tower statistics under RLS.
\set QUIET on
\o /dev/null
set client_min_messages = warning;
begin;
create schema tests;
grant usage on schema tests to public;
create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; raise warning 'ok - %', msg; end $$;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin'),
  ('00000000-0000-0000-0000-00000000000c', 'col1', 'محصل', 'collector'),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee');
insert into public.towers (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'برج أ'),
  ('10000000-0000-0000-0000-000000000002', 'برج ب');
insert into public.towers (name, is_archived) values ('برج مؤرشف', true);

-- s1 active (+20d), s2 expiring (+2d), s3 expired (-5d), s4 no subscription, s5 archived
insert into public.subscribers (id, full_name, phone, tower_id, price, collector_id) values
  ('30000000-0000-0000-0000-000000000001', 'مشترك فعال', '07700000001', '10000000-0000-0000-0000-000000000001', 25000, '00000000-0000-0000-0000-00000000000c'),
  ('30000000-0000-0000-0000-000000000002', 'مشترك قريب', '07700000002', '10000000-0000-0000-0000-000000000001', 25000, null),
  ('30000000-0000-0000-0000-000000000003', 'مشترك منتهي', '07700000003', '10000000-0000-0000-0000-000000000002', 30000, null),
  ('30000000-0000-0000-0000-000000000004', 'مشترك جديد', '07700000004', '10000000-0000-0000-0000-000000000002', 30000, null),
  ('30000000-0000-0000-0000-000000000005', 'مشترك مؤرشف', '07700000005', '10000000-0000-0000-0000-000000000002', 30000, null);
update public.subscribers set end_date = public.today_baghdad() + 20, start_date = public.today_baghdad() - 10 where id = '30000000-0000-0000-0000-000000000001';
update public.subscribers set end_date = public.today_baghdad() + 2, start_date = public.today_baghdad() - 28 where id = '30000000-0000-0000-0000-000000000002';
update public.subscribers set end_date = public.today_baghdad() - 5, start_date = public.today_baghdad() - 35 where id = '30000000-0000-0000-0000-000000000003';
update public.subscribers set end_date = public.today_baghdad() - 1, is_archived = true where id = '30000000-0000-0000-0000-000000000005';

insert into public.subscriptions (subscriber_id, tower_id, kind, start_date, end_date, price) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'new', current_date, current_date + 30, 25000),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'new', current_date, current_date + 30, 30000);
-- s1 paid 15,000 today (debt 10,000); s3 paid 10,000 earlier this month or today (debt 20,000);
-- a voided payment and a payment from last month must not count.
insert into public.payments (subscriber_id, tower_id, kind, amount, received_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'new_subscription', 15000, '00000000-0000-0000-0000-00000000000c'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'new_subscription', 10000, '00000000-0000-0000-0000-00000000000e');
insert into public.payments (subscriber_id, tower_id, kind, amount, received_by, paid_at) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'collection', 1000, '00000000-0000-0000-0000-00000000000e',
   (date_trunc('month', public.today_baghdad())::timestamp at time zone 'Asia/Baghdad') - interval '1 hour');
insert into public.payments (subscriber_id, tower_id, kind, amount, received_by, is_voided, voided_at, void_reason) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'collection', 5000, '00000000-0000-0000-0000-00000000000e', true, now(), 'خطأ إدخال');

select tests.ok((select status from public.subscriber_overview where id = '30000000-0000-0000-0000-000000000001') = 'active', 'status active');
select tests.ok((select status from public.subscriber_overview where id = '30000000-0000-0000-0000-000000000002') = 'expiring', 'status expiring (2 days left)');
select tests.ok((select status from public.subscriber_overview where id = '30000000-0000-0000-0000-000000000003') = 'expired', 'status expired');
select tests.ok((select status from public.subscriber_overview where id = '30000000-0000-0000-0000-000000000004') = 'none', 'status none');
select tests.ok((select days_left from public.subscriber_overview where id = '30000000-0000-0000-0000-000000000002') = 2, 'days_left = 2');

-- Admin view
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
create temp table st on commit drop as select public.dashboard_stats() as j;
select tests.ok((select (j->>'total')::int from st) = 4, 'admin: total excludes archived (4)');
select tests.ok((select (j->>'active')::int from st) = 2, 'admin: active = active + expiring (2)');
select tests.ok((select (j->>'expiring')::int from st) = 1, 'admin: expiring within 3 days (1)');
select tests.ok((select (j->>'expired')::int from st) = 1, 'admin: expired (1)');
select tests.ok((select (j->>'no_subscription')::int from st) = 1, 'admin: no subscription yet (1)');
select tests.ok((select (j->>'towers')::int from st) = 2, 'admin: towers excludes archived (2)');
select tests.ok((select (j->>'collected_month')::int from st) = 25000, 'admin: month cash excludes voided and last month (25,000)');
select tests.ok((select (j->>'collected_today')::int from st) = 25000, 'admin: today cash (25,000)');
select tests.ok((select (j->>'debt')::int from st) = 10000 + 19000, 'admin: debt 10,000 + 19,000 (last-month 1,000 paid)');
select tests.ok((select (j->>'debtors')::int from st) = 2, 'admin: 2 debtors');
select tests.ok((public.dashboard_stats('10000000-0000-0000-0000-000000000002')->>'total')::int = 2, 'admin: per-tower total');

create temp table ts on commit drop as select * from public.tower_stats();
select tests.ok((select subscribers from ts where tower_id = '10000000-0000-0000-0000-000000000001') = 2, 'tower A: 2 subscribers');
select tests.ok((select active from ts where tower_id = '10000000-0000-0000-0000-000000000001') = 2, 'tower A: 2 active');
select tests.ok((select expired from ts where tower_id = '10000000-0000-0000-0000-000000000002') = 1, 'tower B: 1 expired (archived excluded)');
select tests.ok((select debt from ts where tower_id = '10000000-0000-0000-0000-000000000002') = 19000, 'tower B: debt 19,000');
select tests.ok((select collected_month from ts where tower_id = '10000000-0000-0000-0000-000000000002') = 10000, 'tower B: month cash 10,000');
reset role;

-- Collector: only the assigned subscriber is counted
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.ok((public.dashboard_stats()->>'total')::int = 1, 'collector: total = assigned only');
select tests.ok((public.dashboard_stats()->>'debt')::int = 10000, 'collector: debt of assigned only');
select tests.ok((public.dashboard_stats()->>'collected_month')::int = 15000, 'collector: own visible payments only');
select tests.ok((select count(*) from public.subscriber_overview) = 1, 'collector: overview limited by RLS');
reset role;

-- Anonymous: no access
set role anon;
do $$ begin
  perform public.dashboard_stats();
  raise exception 'FAIL: anon could call dashboard_stats';
exception when insufficient_privilege then
  raise warning 'ok - anon cannot call dashboard_stats';
end $$;
reset role;
rollback;
