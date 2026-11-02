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
grant execute on all functions in schema tests to public;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b0'),
  ('00000000-0000-0000-0000-0000000000b1');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b0', false);
select tests.throws($$select public.bootstrap_first_admin('00000000-0000-0000-0000-0000000000b0', 'owner', 'المالك')$$,
  'authenticated users cannot call bootstrap', '42501');
reset role;
set role anon;
select tests.throws($$select public.system_has_staff()$$, 'anon cannot call system_has_staff', '42501');
select tests.throws($$select public.check_setup_token('x')$$, 'anon cannot call check_setup_token', '42501');
reset role;

select private.set_setup_token('test-token-0123456789');
set role service_role;
select tests.ok(not public.system_has_staff(), 'empty system has no staff');
select tests.ok(public.check_setup_token('test-token-0123456789'), 'correct setup token accepted');
select tests.ok(not public.check_setup_token('wrong-token-0123456789'), 'wrong setup token rejected');
select tests.ok(not public.check_setup_token(null), 'null setup token rejected');
select tests.throws($$select private.set_setup_token('x')$$, 'service_role cannot change the setup token', '42501');
select public.bootstrap_first_admin('00000000-0000-0000-0000-0000000000b0', 'owner', 'المالك');
select tests.ok((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b0') = 'admin',
  'first admin created on empty system');
select tests.ok(public.system_has_staff(), 'system now reports staff');
select tests.ok(not public.check_setup_token('test-token-0123456789'), 'setup token stops working once staff exists');
select tests.throws($$select public.bootstrap_first_admin('00000000-0000-0000-0000-0000000000b1', 'owner2', 'شخص آخر')$$,
  'second bootstrap refused', 'P0001');
reset role;
rollback;
