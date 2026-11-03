-- Manager phone on «رابط المشترك».
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
create table tests.vars (k text primary key, v text);
grant all on tests.vars to public;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', '07801112222'),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee', '07709998888');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 's', (public.create_subscriber(p_full_name => 'علي', p_phone => '07701111111',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000) ->> 'id')::uuid;
insert into tests.vars select 't', public.subscriber_link(tests.id('s'));
select tests.ok(public.get_contact_phone() = '07801112222', 'default: the admin profile phone');
reset role;
set role anon;
select tests.ok((select public.subscriber_public_view(v) ->> 'contact_phone' = '07801112222' from tests.vars where k = 't'), 'subscriber page shows the manager phone');
select tests.throws($$select public.get_contact_phone()$$, 'anon cannot call get_contact_phone', '42501');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.set_contact_phone('07700000000')$$, 'employee cannot change it', '42501');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok(public.set_contact_phone('0780 333-4444') = '07803334444', 'admin sets another number (spaces removed)');
select tests.throws($$select public.set_contact_phone('abc')$$, 'invalid number refused', 'P0001');
reset role;
set role anon;
select tests.ok((select public.subscriber_public_view(v) ->> 'contact_phone' = '07803334444' from tests.vars where k = 't'), 'page shows the new number');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok(public.set_contact_phone('') is null, 'admin can hide the number');
reset role;
set role anon;
select tests.ok((select public.subscriber_public_view(v) ->> 'contact_phone' is null from tests.vars where k = 't'), 'hidden: no number on the page');
select tests.ok((select public.subscriber_public_view(v) ->> 'full_name' = 'علي' from tests.vars where k = 't'), 'page still works');
reset role;
rollback;
