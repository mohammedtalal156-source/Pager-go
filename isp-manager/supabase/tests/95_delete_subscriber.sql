-- «حذف المشترك»: voids everything, hides the subscriber, keeps the data.
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
create function tests.id(k text) returns uuid language sql stable as $$ select v from tests.ids where ids.k = id.k $$;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role, can_edit_subscribers, can_view_finance) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', true, true),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee', true, true);
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30);
insert into public.expenses (category, amount, created_by) values ('rent', 1000, '00000000-0000-0000-0000-00000000000a');

-- subscriber to delete: period + payment + renewal + collection + correction + adjustment
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 'del', (public.create_subscriber(p_full_name => 'سيحذف', p_phone => '07701111111',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_package_id => '20000000-0000-0000-0000-000000000001',
  p_price => 25000, p_start_date => public.today_baghdad() - 5, p_amount_paid => 10000) ->> 'id')::uuid;
select public.renew_subscription(tests.id('del'), 1, 25000, 20000);
select public.record_payment(tests.id('del'), 5000);
select public.correct_payment((select id from public.payments where subscriber_id = tests.id('del') and amount = 5000), 6000, 'خطأ');
select public.adjust_debt(tests.id('del'), 1000, (select balance from public.subscribers where id = tests.id('del')), 'تسوية');
-- subscriber that must stay untouched
insert into tests.ids select 'keep', (public.create_subscriber(p_full_name => 'يبقى', p_phone => '07702222222',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_package_id => '20000000-0000-0000-0000-000000000001',
  p_price => 25000, p_start_date => public.today_baghdad(), p_amount_paid => 25000) ->> 'id')::uuid;
reset role;

-- ---------------- protections ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.delete_subscriber(tests.id('del'), 'حذف')$$, 'employee cannot delete subscribers', '42501');
select tests.throws($$update public.subscribers set deleted_at = now() where id = tests.id('del')$$, 'employee cannot hide a subscriber by editing', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$update public.subscribers set deleted_at = now() where id = tests.id('del')$$, 'admin cannot set deleted_at directly', '42501');
select tests.throws($$select public.delete_subscriber(tests.id('del'), 'نعم')$$, 'confirmation word required', 'P0001');
reset role;

-- ---------------- delete ----------------
create temp table before_keep on commit drop as
  select (select balance from public.subscribers where id = tests.id('keep')) bal,
         (select count(*) from public.payments where subscriber_id = tests.id('keep') and not is_voided) pays;
create temp table before_rows on commit drop as
  select (select count(*) from public.payments where subscriber_id = tests.id('del')) pays,
         (select count(*) from public.subscriptions where subscriber_id = tests.id('del')) periods;
grant select on before_keep, before_rows to public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.delete_subscriber(tests.id('del'), 'حذف') ->> 'periods')::int = 2, 'delete: done, 2 periods removed');
select tests.throws($$select public.delete_subscriber(tests.id('del'), 'حذف')$$, 'delete twice: refused', 'P0001');
select tests.ok(not exists (select 1 from public.subscriber_overview where id = tests.id('del')), 'hidden from list/overview');
select tests.ok(not exists (select 1 from public.subscribers where id = tests.id('del')), 'hidden from subscribers table');
select tests.ok((public.dashboard_stats() ->> 'total')::int = 1, 'dashboard counts only the remaining subscriber');
select tests.ok((public.dashboard_stats() ->> 'debt')::int = (select bal from before_keep), 'dashboard debt = remaining subscriber only');
select tests.ok((public.finance_summary(public.today_baghdad() - 30, public.today_baghdad()) ->> 'collected')::int = 25000,
  'revenue only the remaining subscriber (25,000)');
select tests.ok((select sum(collected) from public.report_towers(public.today_baghdad() - 30, public.today_baghdad())) = 25000, 'tower report revenue 25,000');
select tests.throws($$select public.renew_subscription(tests.id('del'), 1, 25000, 25000)$$, 'cannot renew a deleted subscriber', 'P0001');
select tests.throws($$select public.record_payment(tests.id('del'), 1000)$$, 'cannot collect from a deleted subscriber');
reset role;
select tests.ok((select count(*) from public.payments where subscriber_id = tests.id('del')) = (select pays from before_rows)
  and (select count(*) from public.subscriptions where subscriber_id = tests.id('del')) = (select periods from before_rows),
  'nothing physically removed (data kept)');
select tests.ok(not exists (select 1 from public.payments where subscriber_id = tests.id('del') and not is_voided)
  and not exists (select 1 from public.subscriptions where subscriber_id = tests.id('del') and not is_voided),
  'all payments and periods voided');
select tests.ok((select total_due = 0 and total_paid = 0 and balance = 0 and deleted_by = '00000000-0000-0000-0000-00000000000a'
  from public.subscribers where id = tests.id('del')), 'deleted subscriber has no debt, marked with the admin');
select tests.ok((select balance from public.subscribers where id = tests.id('keep')) = (select bal from before_keep)
  and (select count(*) from public.payments where subscriber_id = tests.id('keep') and not is_voided) = (select pays from before_keep),
  'other subscriber untouched');
select tests.ok((select count(*) from public.expenses) = 1, 'expenses untouched');
select tests.ok(exists (select 1 from public.audit_logs where table_name = 'subscribers' and reason like 'حذف المشترك%'
  and actor_id = '00000000-0000-0000-0000-00000000000a'), 'audit records who deleted and why');
select tests.throws($$delete from public.subscribers where id = tests.id('keep')$$, 'physical delete still blocked', '42501');

-- negative adjustment case: amount due never below zero while deleting
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 'neg', (public.create_subscriber(p_full_name => 'تسوية سالبة', p_phone => '07703333333',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000, p_start_date => public.today_baghdad(), p_amount_paid => 0) ->> 'id')::uuid;
select public.adjust_debt(tests.id('neg'), 5000, 25000, 'خصم كبير');
select tests.ok((public.delete_subscriber(tests.id('neg'), 'حذف') ->> 'code') is not null, 'delete with a reducing adjustment works');
reset role;
select tests.ok((select total_due = 0 and balance = 0 from public.subscribers where id = tests.id('neg')), 'reducing adjustment zeroed');

-- import: a deleted subscriber's phone does not block re-adding
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.import_subscribers(gen_random_uuid(), '[{"full_name":"عاد من جديد","phone":"07701111111","tower":"برج أ"}]') ->> 'inserted')::int = 1,
  'import accepts the phone of a deleted subscriber');
select tests.ok(jsonb_array_length(public.export_backup() -> 'subscribers') = 4, 'backup still contains deleted subscribers');
reset role;

-- ---------------- «بعد 3 أيام» filter = 0..3 days ----------------
update public.subscribers set end_date = public.today_baghdad() + 3 where id = tests.id('keep');
select tests.ok((select count(*) from public.subscriber_overview where days_left between 0 and 3) >= 1, 'within 3 days includes day 3');
rollback;
