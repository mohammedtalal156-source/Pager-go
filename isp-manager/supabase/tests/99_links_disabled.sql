-- «رابط المشترك» cancelled: links and their functions are closed to everyone.
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

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, username, full_name, role) values ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.subscribers (id, code, full_name, phone, tower_id) values
  ('30000000-0000-0000-0000-000000000001', 5001, 'علي', '07701111111', '10000000-0000-0000-0000-000000000001');
insert into public.subscriber_links (subscriber_id, token) values ('30000000-0000-0000-0000-000000000001', repeat('a', 64));

set role anon;
select tests.throws($$select public.subscriber_public_view(repeat('a', 64))$$, 'old link no longer opens (anon)', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.subscriber_public_view(repeat('a', 64))$$, 'not even for staff', '42501');
select tests.throws($$select public.subscriber_link('30000000-0000-0000-0000-000000000001')$$, 'no new links', '42501');
select tests.throws($$select public.reset_subscriber_link('30000000-0000-0000-0000-000000000001')$$, 'no link reset', '42501');
select tests.throws($$select public.set_contact_phone('07700000000')$$, 'contact phone setting closed', '42501');
reset role;
select tests.ok((select count(*) from public.subscriber_links) = 1, 'nothing deleted');
rollback;
