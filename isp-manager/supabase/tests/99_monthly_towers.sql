-- Calendar-month periods for monthly towers.
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

create function tests.id(k text) returns uuid language sql stable as $$ select v from tests.ids where ids.k = id.k $$;
grant execute on function tests.id(text) to public;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, username, full_name, role) values ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin');
insert into public.towers (id, name, monthly_period) values
  ('10000000-0000-0000-0000-000000000001', 'شهري', true),
  ('10000000-0000-0000-0000-000000000002', 'أيام', false);
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة', 25000, 30);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 'm', (public.create_subscriber(p_full_name => 'شهري', p_phone => '07701111111',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_package_id => '20000000-0000-0000-0000-000000000001',
  p_price => 25000, p_start_date => public.today_baghdad(), p_end_date => public.today_baghdad() + 1, p_amount_paid => 25000) ->> 'id')::uuid;
insert into tests.ids select 'd', (public.create_subscriber(p_full_name => 'أيام', p_phone => '07702222222',
  p_tower_id => '10000000-0000-0000-0000-000000000002', p_package_id => '20000000-0000-0000-0000-000000000001',
  p_price => 25000, p_start_date => public.today_baghdad(), p_end_date => public.today_baghdad() + 1, p_amount_paid => 25000) ->> 'id')::uuid;
reset role;
-- fixed dates for the check: end 2026-01-31 (month-end) and 2026-11-11
update public.subscribers set end_date = '2099-11-11' where id = tests.id('m');
update public.subscribers set end_date = '2099-11-11' where id = tests.id('d');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.renew_subscription(tests.id('m'), 1, 25000, 0) ->> 'end_date') = '2099-12-11', 'monthly tower: 11/11 → 11/12');
select tests.ok((public.renew_subscription(tests.id('m'), 2, 50000, 0) ->> 'end_date') = '2100-02-11', 'monthly tower: two months → 11/02');
select public.renew_subscription(tests.id('d'), 1, 25000, 0);
reset role;
select tests.ok((select end_date from public.subscribers where id = tests.id('d')) = '2099-11-11'::date + 30, 'day tower unchanged: +30 days');
update public.subscribers set start_date = '2099-01-01', end_date = '2099-01-31' where id = tests.id('m');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.renew_subscription(tests.id('m'), 1, 25000, 0) ->> 'end_date') = '2099-02-28', 'month end: 31/01 → 28/02');
select tests.ok((public.renew_subscription(tests.id('m'), 1, 25000, 0, null, '2099-06-05') ->> 'end_date') = '2099-07-05', 'admin start date: 05/06 → 05/07');
reset role;
update public.subscribers set start_date = public.today_baghdad() - 40, end_date = public.today_baghdad() - 10 where id = tests.id('m');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.renew_subscription(tests.id('m'), 1, 25000, 0) ->> 'end_date')::date = (public.today_baghdad() + interval '1 month')::date, 'expired: today + 1 month');
select tests.ok((select tower_monthly from public.subscriber_overview where id = tests.id('m')) and not (select tower_monthly from public.subscriber_overview where id = tests.id('d')), 'overview shows the tower rule');
reset role;
rollback;
