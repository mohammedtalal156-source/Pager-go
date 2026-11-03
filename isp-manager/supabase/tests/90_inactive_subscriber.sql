-- Adding an inactive subscriber: no period, no payment, no debt; activation by renewal.
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

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role) values ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
-- exactly what the form sends for «غير فعّال»
insert into tests.ids select 's', (public.create_subscriber(
  p_full_name => 'مشترك غير فعال', p_phone => '07701234567', p_tower_id => '10000000-0000-0000-0000-000000000001',
  p_package_id => '20000000-0000-0000-0000-000000000001', p_price => 25000,
  p_start_date => null, p_end_date => null, p_amount_paid => 0) ->> 'id')::uuid;
select tests.throws($$select public.create_subscriber(p_full_name => 'خطأ', p_phone => '07701234568',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000, p_start_date => null, p_amount_paid => 5000)$$,
  'inactive: a payment without a subscription is rejected', 'P0001');
reset role;

select tests.ok((select count(*) from public.subscriptions where subscriber_id = (select v from tests.ids)) = 0, 'inactive: no subscription period');
select tests.ok((select count(*) from public.payments where subscriber_id = (select v from tests.ids)) = 0, 'inactive: no payment');
select tests.ok((select balance = 0 and start_date is null and end_date is null and price = 25000
  from public.subscribers where id = (select v from tests.ids)), 'inactive: no debt, no dates, price kept for activation');
select tests.ok((select status from public.subscriber_overview where id = (select v from tests.ids)) = 'none', 'inactive: status none (غير فعّال)');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.ok((public.dashboard_stats()->>'active')::int = 0 and (public.dashboard_stats()->>'no_subscription')::int = 1
  and (public.dashboard_stats()->>'debt')::int = 0, 'inactive: dashboard counts it as inactive with no debt');

-- activation later = renewal: starts today, records the money
select public.renew_subscription((select v from tests.ids), 1, 25000, 25000);
reset role;
select tests.ok((select start_date = public.today_baghdad() and end_date = public.today_baghdad() + 30 and balance = 0
  from public.subscribers where id = (select v from tests.ids)), 'activation: starts today for the package duration, paid in full');
select tests.ok((select status from public.subscriber_overview where id = (select v from tests.ids)) = 'active', 'activation: now active');
select tests.ok((select sum(amount) from public.payments where subscriber_id = (select v from tests.ids)) = 25000, 'activation: payment recorded');
rollback;
