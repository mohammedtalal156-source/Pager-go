-- «رابط المشترك»: private read-only page by token.
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

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin'),
  ('00000000-0000-0000-0000-00000000000c', 'col', 'جابي', 'collector');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');
insert into public.packages (id, name, price, duration_days) values ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 's', (public.create_subscriber(p_full_name => 'علي حسن', p_phone => '07701111111',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_package_id => '20000000-0000-0000-0000-000000000001',
  p_price => 25000, p_start_date => public.today_baghdad(), p_amount_paid => 10000) ->> 'id')::uuid;
insert into tests.ids select 'other', (public.create_subscriber(p_full_name => 'غيره', p_phone => '07702222222',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000) ->> 'id')::uuid;
insert into tests.vars select 't', public.subscriber_link(tests.id('s'));
select tests.ok((select v ~ '^[0-9a-f]{64}$' from tests.vars where k = 't'), 'link token is 64 random hex chars');
select tests.ok(public.subscriber_link(tests.id('s')) = (select v from tests.vars where k = 't'), 'same link every time');
select tests.ok(public.subscriber_link(tests.id('other')) <> (select v from tests.vars where k = 't'), 'each subscriber has its own link');
reset role;

-- unassigned collector cannot get the link
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.throws($$select public.subscriber_link(tests.id('s'))$$, 'unassigned collector cannot get the link', '42501');
select tests.throws($$select * from public.subscriber_links$$, 'staff cannot read the links table', '42501');
reset role;

-- public view as anon (no login)
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok((select (public.subscriber_public_view(v) ->> 'full_name') = 'علي حسن' from tests.vars where k = 't'), 'anon opens own page');
select tests.ok((select (public.subscriber_public_view(v) ->> 'balance')::int = 15000 from tests.vars where k = 't'), 'debt shown (25,000 - 10,000)');
select tests.ok((select json_array_length(public.subscriber_public_view(v) -> 'payments') = 1 from tests.vars where k = 't'), 'payments shown');
select tests.ok((select public.subscriber_public_view(v)::jsonb ? 'phone' = false from tests.vars where k = 't'), 'phone not exposed');
select tests.ok(public.subscriber_public_view(repeat('0', 64)) is null, 'wrong token: nothing');
select tests.ok(public.subscriber_public_view('abc') is null, 'malformed token: nothing');
select tests.throws($$select public.subscriber_link(tests.id('s'))$$, 'anon cannot create links', '42501');
select tests.throws($$select * from public.subscriber_links$$, 'anon cannot read links', '42501');
select tests.throws($$select * from public.subscribers$$, 'anon still cannot read subscribers', '42501');
reset role;

-- reset: old link stops working
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.vars select 't2', public.reset_subscriber_link(tests.id('s'));
reset role;
set role anon;
select tests.ok((select public.subscriber_public_view(v) is null from tests.vars where k = 't'), 'old link no longer works');
select tests.ok((select public.subscriber_public_view(v) is not null from tests.vars where k = 't2'), 'new link works');
reset role;

-- deleted subscriber: link stops working
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.delete_subscriber(tests.id('s'), 'حذف');
reset role;
set role anon;
select tests.ok((select public.subscriber_public_view(v) is null from tests.vars where k = 't2'), 'deleted subscriber: link closed');
reset role;
rollback;
