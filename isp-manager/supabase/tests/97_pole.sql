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
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-000000000005');
insert into public.profiles (id, username, full_name, role, can_create_subscribers) values
  ('00000000-0000-0000-0000-000000000005', 'nocreate', 'بدون إضافة', 'employee', false);
insert into public.profiles (id, username, full_name, role) values ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
insert into tests.ids select 'p', (public.create_subscriber_with_pole(p_full_name => 'علي جديد', p_phone => '07701110001',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_pole => '47', p_price => 25000,
  p_start_date => public.today_baghdad(), p_amount_paid => 25000, p_request_id => '95000000-0000-0000-0000-000000000001') ->> 'id')::uuid;
select tests.ok((public.create_subscriber_with_pole(p_full_name => 'علي جديد', p_phone => '07701110001',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_pole => '99', p_request_id => '95000000-0000-0000-0000-000000000001') ->> 'duplicate')::boolean,
  'pole create: double click returns the first');
insert into tests.ids select 'np', (public.create_subscriber_with_pole(p_full_name => 'بدون عامود', p_phone => '07701110002',
  p_tower_id => '10000000-0000-0000-0000-000000000001') ->> 'id')::uuid;
reset role;
-- old subscriber with the pole written in the name
insert into public.subscribers (full_name, phone, tower_id) values ('احمد محسن عامود 47', '9647701110003', '10000000-0000-0000-0000-000000000001'),
  ('سجاد عامود 470', '07701110004', '10000000-0000-0000-0000-000000000001'), ('كرار عامود 4', '07701110005', '10000000-0000-0000-0000-000000000001');

select tests.ok((select pole from public.subscribers where id = (select v from tests.ids where k = 'p')) = '47', 'pole saved on create');
select tests.ok((select pole is null from public.subscribers where id = (select v from tests.ids where k = 'np')), 'pole optional');
select tests.ok((select count(*) from public.subscribers) = 5, 'double click made no second subscriber');
select tests.ok((select balance = 0 and end_date is not null from public.subscribers where id = (select v from tests.ids where k = 'p')), 'create logic unchanged (period + payment)');
select tests.ok((select pole from public.subscriber_overview where id = (select v from tests.ids where k = 'p')) = '47', 'pole in overview');

-- the search the app runs for «عامود 47»
select tests.ok((select count(*) from public.subscriber_overview where pole = '47' or search_text ilike '%عامود 47 %') = 2,
  'search «عامود 47»: pole field + old name, not 470 or 4');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
set role authenticated;
select tests.throws($$select public.create_subscriber_with_pole(p_full_name => 'xx', p_phone => '07701110009', p_tower_id => '10000000-0000-0000-0000-000000000001', p_pole => '1')$$,
  'pole create keeps the create permission', '42501');
reset role;

-- edit (employee with edit permission) sets the pole of an old subscriber
update public.profiles set can_edit_subscribers = true where id = '00000000-0000-0000-0000-00000000000e';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
update public.subscribers set pole = '12' where id = (select v from tests.ids where k = 'np');
reset role;
select tests.ok((select pole from public.subscribers where id = (select v from tests.ids where k = 'np')) = '12', 'edit sets the pole');
select tests.throws($$update public.subscribers set pole = repeat('1', 51)$$, 'pole length limited', '23514');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.export_backup() -> 'subscribers' -> 0) ? 'pole', 'backup includes the pole');
reset role;
rollback;
