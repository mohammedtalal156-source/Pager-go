-- Phase 6 tests: import, backup export, restore into an empty system.
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
create table tests.vars (k text primary key, v jsonb);
grant all on tests.vars to public;
grant execute on all functions in schema tests to public;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin'),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج الكرادة');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30);
insert into public.subscribers (full_name, phone, tower_id, price) values ('موجود سابقاً', '07700000009', '10000000-0000-0000-0000-000000000001', 25000);

-- ---------------- import ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.import_subscribers(gen_random_uuid(), '[{"full_name":"x y","phone":"07700000001","tower":"t"}]')$$,
  'import: employee rejected', '42501');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.vars select 'imp', public.import_subscribers('70000000-0000-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('full_name', 'علي حسن', 'phone', '07701111111', 'tower', 'برج الكرادة', 'area', 'الكرادة', 'package', 'باقة 25',
    'price', 25000, 'start_date', (public.today_baghdad() - 10)::text, 'end_date', (public.today_baghdad() + 20)::text, 'remaining', 10000),
  jsonb_build_object('full_name', 'زينب كاظم', 'phone', '07702222222', 'tower', 'برج جديد', 'price', 30000,
    'end_date', (public.today_baghdad() - 5)::text, 'remaining', 0),
  jsonb_build_object('full_name', 'مكرر', 'phone', '07700000009', 'tower', 'برج الكرادة', 'price', 1)
))::jsonb;
select tests.ok((select (v->>'inserted')::int from tests.vars where k = 'imp') = 2, 'import: 2 inserted');
select tests.ok((select (v->>'skipped')::int from tests.vars where k = 'imp') = 1, 'import: existing phone skipped');
select tests.ok((select (v->>'towers_created')::int from tests.vars where k = 'imp') = 1, 'import: missing tower created');
select tests.ok((public.import_subscribers('70000000-0000-0000-0000-000000000001', '[{"full_name":"x y","phone":"07709999999","tower":"t"}]') ->> 'duplicate')::boolean,
  'import: same batch id not imported twice (double click)');
reset role;
select tests.ok((select count(*) from public.subscribers) = 3, 'import: total subscribers 3');
select tests.ok((select balance from public.subscribers where phone = '07701111111') = 10000, 'import: remaining amount becomes opening debt');
select tests.ok((select count(*) from public.payments) = 0, 'import: opening debt is not revenue (no payments)');
select tests.ok((select end_date from public.subscribers where phone = '07701111111') = public.today_baghdad() + 20, 'import: end date kept');
select tests.ok((select package_id from public.subscribers where phone = '07701111111') = '20000000-0000-0000-0000-000000000001', 'import: package matched by name');
select tests.ok((select status from public.subscriber_overview where phone = '07702222222') = 'expired', 'import: expired status from imported date');

-- add some financial history to back up
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select public.record_payment((select id from public.subscribers where phone = '07701111111'), 4000);
select public.renew_subscription((select id from public.subscribers where phone = '07702222222'), 1, 30000, 20000);
reset role;
insert into public.expenses (category, amount, created_by) values ('rent', 50000, '00000000-0000-0000-0000-00000000000a');

-- ---------------- backup ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.export_backup()$$, 'backup: employee rejected', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into tests.vars select 'bk', public.export_backup();
select tests.ok(public.create_backup_snapshot() > 0, 'backup: manual snapshot stored');
select tests.ok((select count(*) from public.list_backups()) = 1, 'backup: snapshot listed');
select tests.ok((public.get_backup((select id from public.list_backups() limit 1)) ->> 'format') = 'isp-manager-backup', 'backup: snapshot downloadable');
select tests.throws($$select public.restore_backup((select v from tests.vars where k = 'bk'), 'استعادة')$$,
  'restore: refused when system is not empty', 'P0001');
reset role;
select tests.ok((select jsonb_array_length(v->'subscribers') from tests.vars where k = 'bk') = 3, 'backup: contains all subscribers');
select tests.ok((select jsonb_array_length(v->'payments') from tests.vars where k = 'bk') = 2, 'backup: contains payments');

create temp table before on commit drop as
  select phone, balance, end_date, code from public.subscribers;

-- simulate a lost database: wipe business tables (triggers off, superuser only)
set session_replication_role = replica;
delete from public.renewals; delete from public.payments; delete from public.subscriptions;
delete from public.expenses; delete from public.subscribers; delete from public.packages; delete from public.towers;
set session_replication_role = origin;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.restore_backup((select v from tests.vars where k = 'bk'), 'نعم')$$, 'restore: confirmation word required', 'P0001');
select tests.throws($$select public.restore_backup('{"format":"other"}', 'استعادة')$$, 'restore: wrong file rejected', 'P0001');
insert into tests.vars select 'rs', public.restore_backup((select v from tests.vars where k = 'bk'), 'استعادة')::jsonb;
reset role;
select tests.ok((select (v->>'subscribers')::int from tests.vars where k = 'rs') = 3, 'restore: subscribers restored');
select tests.ok(not exists (
  select 1 from before b join public.subscribers s using (phone)
  where s.balance is distinct from b.balance or s.end_date is distinct from b.end_date or s.code is distinct from b.code
) and (select count(*) from public.subscribers) = (select count(*) from before),
  'restore: balances, end dates and subscriber numbers identical');
select tests.ok((select count(*) from public.payments) = 2 and (select count(*) from public.renewals) = 1 and (select count(*) from public.expenses) = 1,
  'restore: payments, renewals and expenses restored');
select tests.ok(nextval('public.subscriber_code_seq') > (select max(code) from public.subscribers), 'restore: subscriber numbering continues after restored codes');
rollback;
