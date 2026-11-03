-- «الكابينات»: poles 1..50, add, remove (hide only, refused while subscribers are on it).
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


insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin'),
  ('00000000-0000-0000-0000-00000000000e', 'emp', 'موظف', 'employee');
insert into public.towers (id, name) values ('10000000-0000-0000-0000-000000000001', 'برج أ');

select tests.ok((select count(*) from public.poles where hidden_at is null) = 50, 'poles 1..50 created');
select tests.ok(exists (select 1 from public.poles where name = '1') and exists (select 1 from public.poles where name = '50'), 'pole 1 and 50 exist');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into tests.ids select 'on7', (public.create_subscriber_with_pole(p_full_name => 'على السبعة', p_phone => '07701111111',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_pole => '7', p_price => 25000) ->> 'id')::uuid;
insert into tests.ids select 'old', (public.create_subscriber(p_full_name => 'قديم عامود 9 الحي', p_phone => '07702222222',
  p_tower_id => '10000000-0000-0000-0000-000000000001', p_price => 25000) ->> 'id')::uuid;
reset role;
create temp table before_subs on commit drop as select id, pole, full_name, balance, updated_at from public.subscribers;
grant select on before_subs to public;

-- permissions
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.ok((select count(*) from public.poles) = 50, 'employee can read poles');
select tests.throws($$select public.remove_pole('3')$$, 'employee cannot remove a pole', '42501');
select tests.throws($$select public.add_pole('60')$$, 'employee cannot add a pole', '42501');
select tests.throws($$update public.poles set hidden_at = now() where name = '3'$$, 'no direct edit of poles', '42501');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$delete from public.poles where name = '3'$$, 'no direct delete of poles', '42501');
-- remove
select tests.throws($$select public.remove_pole('7')$$, 'pole with a subscriber cannot be removed', 'P0001');
select tests.throws($$select public.remove_pole('9')$$, 'pole written in an old name cannot be removed', 'P0001');
select tests.ok((public.remove_pole('3') ->> 'name') = '3', 'empty pole removed');
select tests.throws($$select public.remove_pole('3')$$, 'removing twice refused', 'P0001');
select tests.ok((select count(*) from public.poles where hidden_at is null) = 49, '49 poles shown');
-- add back / new
select tests.ok((public.add_pole('عامود 3') ->> 'name') = '3', 'removed pole added back (word «عامود» stripped)');
select tests.ok((public.add_pole('51') ->> 'name') = '51', 'new pole 51 added');
select tests.throws($$select public.add_pole('51')$$, 'duplicate pole refused', 'P0001');
select tests.throws($$select public.add_pole('  ')$$, 'empty name refused', 'P0001');
reset role;
select tests.ok((select count(*) from public.poles where hidden_at is null) = 51, '51 poles shown');
select tests.ok((select count(*) from public.poles) = 51, 'no pole row ever deleted');
select tests.ok((select count(*) from public.subscribers) = (select count(*) from before_subs)
  and not exists (select 1 from public.subscribers s join before_subs b using (id)
    where s.pole is distinct from b.pole or s.full_name <> b.full_name or s.balance <> b.balance or s.updated_at <> b.updated_at),
  'subscribers untouched');
select tests.ok((select count(*) from public.audit_logs where table_name = 'poles' and reason = 'حذف عامود') = 1, 'removal audited');
rollback;
