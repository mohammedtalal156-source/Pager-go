-- Admin delete of a subscriber with all periods, payments, renewals and adjustments.
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
select tests.throws($$delete from public.subscribers where id = tests.id('del')$$, 'no direct delete for clients', '42501');
select tests.throws($$delete from public.payments where subscriber_id = tests.id('del')$$, 'no direct delete of payments', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.delete_subscriber(tests.id('del'), 'نعم')$$, 'confirmation word required', 'P0001');
-- even an admin session that sets the flag itself cannot delete directly (no DELETE privilege)
select tests.throws($$select set_config('app.allow_subscriber_delete', 'on', true); delete from public.payments where subscriber_id = tests.id('del')$$,
  'flag alone does not grant delete', '42501');
reset role;
select tests.throws($$delete from public.expenses$$, 'expenses still undeletable', '42501');

-- ---------------- delete ----------------
create temp table before_keep on commit drop as
  select (select balance from public.subscribers where id = tests.id('keep')) bal,
         (select count(*) from public.payments where subscriber_id = tests.id('keep')) pays;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.delete_subscriber(tests.id('del'), 'حذف') ->> 'periods')::int = 2, 'delete: done, reports 2 periods');
select tests.throws($$select public.delete_subscriber(tests.id('del'), 'حذف')$$, 'delete twice: not found', 'P0001');
select tests.ok((public.finance_summary(public.today_baghdad() - 30, public.today_baghdad()) ->> 'collected')::int = 25000,
  'revenue now only the remaining subscriber (25,000)');
select tests.ok((public.dashboard_stats() ->> 'total')::int = 1, 'dashboard total 1');
reset role;
select tests.ok(not exists (select 1 from public.subscribers where id = tests.id('del')), 'subscriber gone');
select tests.ok(not exists (select 1 from public.subscriptions where subscriber_id = tests.id('del'))
  and not exists (select 1 from public.payments where subscriber_id = tests.id('del'))
  and not exists (select 1 from public.renewals where subscriber_id = tests.id('del'))
  and not exists (select 1 from public.debt_adjustments where subscriber_id = tests.id('del')), 'periods, payments, renewals, adjustments gone');
select tests.ok((select balance from public.subscribers where id = tests.id('keep')) = (select bal from before_keep)
  and (select count(*) from public.payments where subscriber_id = tests.id('keep')) = (select pays from before_keep), 'other subscriber untouched');
select tests.ok((select count(*) from public.expenses) = 1, 'expenses untouched');
select tests.ok((select count(*) from public.audit_logs where action = 'DELETE' and table_name = 'subscribers'
  and old_data->>'full_name' = 'سيحذف' and reason like 'حذف المشترك%' and actor_id = '00000000-0000-0000-0000-00000000000a') = 1,
  'audit keeps a copy of the deleted subscriber, who and why');
select tests.ok((select count(*) from public.audit_logs where action = 'DELETE' and table_name = 'payments') >= 3, 'audit keeps deleted payments');
select tests.throws($$delete from public.subscribers where id = tests.id('keep')$$, 'outside the function, delete is blocked again', '42501');

-- ---------------- «بعد 3 أيام» filter = 0..3 days ----------------
update public.subscribers set end_date = public.today_baghdad() + 3 where id = tests.id('keep');
select tests.ok((select count(*) from public.subscriber_overview where days_left between 0 and 3) = 1, 'within 3 days includes day 3');
rollback;
