-- Phase 8 tests: editing subscribers, date corrections, payment corrections,
-- permissions and the audit trail.
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
create table tests.vars (k text primary key, v jsonb);
grant all on tests.ids, tests.vars to public;
grant execute on all functions in schema tests to public;
create function tests.id(k text) returns uuid language sql stable as $$ select v from tests.ids where ids.k = id.k $$;
grant execute on function tests.id(text) to public;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-000000000005'), ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, full_name, role, can_edit_subscribers, can_view_finance) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'المدير', 'admin', true, true),
  ('00000000-0000-0000-0000-00000000000e', 'editor', 'موظف مخوّل', 'employee', true, true),
  ('00000000-0000-0000-0000-000000000005', 'plain', 'موظف عادي', 'employee', false, false),
  ('00000000-0000-0000-0000-00000000000c', 'col', 'جابي', 'collector', false, false);
insert into public.towers (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'برج أ'), ('10000000-0000-0000-0000-000000000002', 'برج ب');
insert into public.packages (id, name, price, duration_days) values
  ('20000000-0000-0000-0000-000000000001', 'باقة 25', 25000, 30),
  ('20000000-0000-0000-0000-000000000002', 'باقة 35', 35000, 30);

-- The user's example: price 25,000; staff typed 20,000 but 15,000 was paid.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
insert into tests.ids select 's', (public.create_subscriber(
  p_full_name => 'علي حسن', p_phone => '07701234567', p_tower_id => '10000000-0000-0000-0000-000000000001',
  p_package_id => '20000000-0000-0000-0000-000000000001', p_price => 25000,
  p_start_date => public.today_baghdad() - 20, p_amount_paid => 20000) ->> 'id')::uuid;
reset role;
insert into tests.ids select 'p1', id from public.payments where subscriber_id = tests.id('s');
select tests.ok((select balance from public.subscribers where id = tests.id('s')) = 5000, 'setup: wrong entry leaves 5,000 debt');

-- ---------------- permissions ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select tests.throws($$select public.correct_payment(tests.id('p1'), 15000, 'خطأ إدخال')$$, 'correct: employee (even with edit permission) rejected', '42501');
select tests.throws($$select public.set_subscriber_dates(tests.id('s'), current_date, current_date + 5, 'تصحيح')$$, 'dates: employee rejected', '42501');
select tests.throws($$select * from public.subscriber_history(tests.id('s'))$$, 'history: employee rejected', '42501');
select tests.throws($$update public.payments set amount = 15000 where id = tests.id('p1')$$, 'payments cannot be edited directly', '42501');
select tests.throws($$delete from public.payments where id = tests.id('p1')$$, 'payments cannot be deleted', '42501');
select tests.throws($$update public.subscribers set end_date = current_date + 90 where id = tests.id('s')$$, 'subscriber dates cannot be edited directly', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select tests.throws($$select public.correct_payment(tests.id('p1'), 15000, 'خطأ إدخال')$$, 'correct: collector rejected', '42501');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$update public.payments set amount = 15000 where id = tests.id('p1')$$, 'admin also cannot edit a payment row directly', '42501');
select tests.throws($$select public.correct_payment(tests.id('p1'), 15000, 'ab')$$, 'correct: reason required', 'P0001');
select tests.throws($$select public.correct_payment(tests.id('p1'), 0, 'خطأ إدخال')$$, 'correct: zero amount rejected', 'P0001');
select tests.throws($$select public.correct_payment(tests.id('p1'), 20000, 'خطأ إدخال')$$, 'correct: same amount rejected', 'P0001');
select tests.throws($$select public.correct_payment(tests.id('p1'), 30000, 'خطأ إدخال')$$, 'correct: cannot exceed what is due (25,000)', 'P0001');

-- ---------------- the correction ----------------
insert into tests.vars select 'c', public.correct_payment(tests.id('p1'), 15000, 'المشترك دفع 15 ألف وليس 20', '91000000-0000-0000-0000-000000000001')::jsonb;
select tests.ok((select (v->>'duplicate')::boolean from tests.vars where k = 'c') = false, 'correct: done');
select tests.ok((select (public.correct_payment(tests.id('p1'), 15000, 'المشترك دفع 15 ألف وليس 20', '91000000-0000-0000-0000-000000000001')->>'duplicate')::boolean),
  'correct: double click returns the first result');
select tests.throws($$select public.correct_payment(tests.id('p1'), 16000, 'مرة ثانية')$$, 'correct: the original cannot be corrected twice', 'P0001');
reset role;

select tests.ok((select balance from public.subscribers where id = tests.id('s')) = 10000, 'correct: remaining is 10,000');
select tests.ok((select total_paid from public.subscribers where id = tests.id('s')) = 15000, 'correct: paid is 15,000');
select tests.ok((select count(*) from public.payments where subscriber_id = tests.id('s')) = 2, 'correct: exactly one new payment row (no duplicates)');
select tests.ok((select sum(amount) from public.payments where subscriber_id = tests.id('s') and not is_voided) = 15000, 'correct: revenue counted once (15,000)');
select tests.ok((select is_voided and void_reason like '%15000%' and voided_by = '00000000-0000-0000-0000-00000000000a' and amount = 20000
  from public.payments where id = tests.id('p1')), 'correct: original kept (20,000), voided by admin with reason');
select tests.ok((select corrects_payment_id = tests.id('p1') and paid_at = (select paid_at from public.payments where id = tests.id('p1'))
  and received_by = '00000000-0000-0000-0000-00000000000e' and kind = 'new_subscription'
  from public.payments where id = ((select v from tests.vars where k = 'c')->>'payment_id')::uuid),
  'correct: new payment linked to original, same date, receiver and kind');
select tests.ok((select count(*) from public.audit_logs where table_name = 'payments' and reason like 'تصحيح مبلغ الوصل%') = 2,
  'correct: void + new payment both in audit log with the reason');
select tests.ok((select actor_id from public.audit_logs where table_name = 'payments' and action = 'INSERT' and reason like 'تصحيح%')
  = '00000000-0000-0000-0000-00000000000a', 'correct: audit records who corrected it');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((public.finance_summary(public.today_baghdad() - 1, public.today_baghdad())->>'collected')::int = 15000,
  'finance: collected 15,000 (not 35,000)');
select tests.ok((public.finance_summary(public.today_baghdad() - 1, public.today_baghdad())->>'debt')::int = 10000,
  'finance: debt 10,000 (not 15,000)');
select tests.ok((public.dashboard_stats()->>'collected_today')::int = 15000, 'dashboard: today 15,000');
reset role;

-- ---------------- edit a subscriber with renewals and payments ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select public.renew_subscription(tests.id('s'), 1, 25000, 25000);
select public.record_payment(tests.id('s'), 4000);
reset role;
create temp table before on commit drop as
  select end_date, start_date, balance, total_due, total_paid from public.subscribers where id = tests.id('s');
create temp table before_counts on commit drop as select
  (select count(*) from public.renewals) r, (select count(*) from public.subscriptions) sb, (select count(*) from public.payments) p;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
set role authenticated;
update public.subscribers set full_name = 'محاولة' where id = tests.id('s');
reset role;
select tests.ok((select full_name from public.subscribers where id = tests.id('s')) = 'علي حسن', 'edit: employee without permission changes nothing');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
update public.subscribers
set full_name = 'علي حسن كاظم', phone = '07801112222', phone2 = '07709998888',
    tower_id = '10000000-0000-0000-0000-000000000002', area = 'الكرادة', address = 'شارع 62',
    package_id = '20000000-0000-0000-0000-000000000002', price = 35000,
    collector_id = '00000000-0000-0000-0000-00000000000c', notes = 'ملاحظة جديدة'
where id = tests.id('s');
reset role;
select tests.ok((select full_name = 'علي حسن كاظم' and phone = '07801112222' and phone2 = '07709998888'
  and tower_id = '10000000-0000-0000-0000-000000000002' and area = 'الكرادة' and address = 'شارع 62'
  and package_id = '20000000-0000-0000-0000-000000000002' and price = 35000
  and collector_id = '00000000-0000-0000-0000-00000000000c' and notes = 'ملاحظة جديدة'
  from public.subscribers where id = tests.id('s')), 'edit: all descriptive fields saved');
select tests.ok((select s.end_date = b.end_date and s.start_date = b.start_date and s.balance = b.balance
  and s.total_due = b.total_due and s.total_paid = b.total_paid
  from public.subscribers s, before b where s.id = tests.id('s')), 'edit: dates and balances unchanged');
select tests.ok((select (select count(*) from public.renewals) = r and (select count(*) from public.subscriptions) = sb
  and (select count(*) from public.payments) = p from before_counts), 'edit: renewal and payment history untouched');
select tests.ok((select count(*) from public.payments p where p.subscriber_id = tests.id('s') and p.tower_id = '10000000-0000-0000-0000-000000000001') = 4,
  'edit: past payments keep the old tower (reports per tower stay correct)');
select tests.ok(exists (select 1 from public.audit_logs where table_name = 'subscribers' and record_id = tests.id('s')::text
  and action = 'UPDATE' and old_data->>'full_name' = 'علي حسن' and new_data->>'full_name' = 'علي حسن كاظم'
  and actor_id = '00000000-0000-0000-0000-00000000000e'), 'edit: audit log keeps old and new values and the editor');
select tests.ok((select tower_name from public.subscriber_overview where id = tests.id('s')) = 'برج ب', 'edit: shows in the overview');

-- ---------------- date corrections and alerts ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.throws($$select public.set_subscriber_dates(tests.id('s'), current_date, current_date - 1, 'خطأ')$$, 'dates: end before start rejected', 'P0001');
select tests.throws($$select public.set_subscriber_dates(tests.id('s'), current_date, current_date, 'ab')$$, 'dates: reason required', 'P0001');
create temp table st0 on commit drop as select public.dashboard_stats() j;
select public.set_subscriber_dates(tests.id('s'), public.today_baghdad() - 28, public.today_baghdad() + 2, 'تصحيح تاريخ الانتهاء');
select tests.ok((select status from public.subscriber_overview where id = tests.id('s')) = 'expiring', 'dates: +2 days → expiring');
select tests.ok((select days_left from public.subscriber_overview where id = tests.id('s')) = 2, 'dates: days_left = 2');
select tests.ok((public.dashboard_stats()->>'expiring')::int = (select (j->>'expiring')::int from st0) + 1, 'dates: dashboard alert count updated');
select public.set_subscriber_dates(tests.id('s'), public.today_baghdad() - 31, public.today_baghdad() - 1, 'انتهى أمس');
select tests.ok((select status from public.subscriber_overview where id = tests.id('s')) = 'expired', 'dates: yesterday → expired');
select tests.ok((public.dashboard_stats()->>'expired')::int = (select (j->>'expired')::int from st0) + 1, 'dates: dashboard expired count updated');
select public.set_subscriber_dates(tests.id('s'), public.today_baghdad(), public.today_baghdad() + 60, 'مدة 60 يوم');
select tests.ok((select status = 'active' and days_left = 60 from public.subscriber_overview where id = tests.id('s')), 'dates: custom duration → active');
reset role;
select tests.ok((select balance from public.subscribers where id = tests.id('s')) = (select balance from before), 'dates: balance unchanged');
select tests.ok((select (select count(*) from public.renewals) = r and (select count(*) from public.subscriptions) = sb from before_counts)
  and not exists (select 1 from public.subscriptions where subscriber_id = tests.id('s') and is_voided),
  'dates: renewal history and billed periods untouched');
select tests.ok((select count(*) from public.audit_logs where table_name = 'subscribers' and record_id = tests.id('s')::text and reason = 'مدة 60 يوم') = 1,
  'dates: change audited with the reason');

-- ---------------- correcting a renewal payment, then voiding the renewal ----------------
insert into tests.ids select 'rp', payment_id from public.renewals where subscriber_id = tests.id('s');
insert into tests.ids select 'rn', id from public.renewals where subscriber_id = tests.id('s');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.correct_payment(tests.id('rp'), 21000, 'كان 21 ألف');
reset role;
select tests.ok((select balance from public.subscribers where id = tests.id('s')) = (select balance from before) + 4000,
  'renewal payment corrected: debt +4,000');
set role authenticated;
select public.void_renewal(tests.id('rn'), 'تجديد بالخطأ');
reset role;
select tests.ok(not exists (select 1 from public.payments where subscription_id = (select subscription_id from public.renewals where id = tests.id('rn')) and not is_voided),
  'void renewal: the corrected payment is voided too');
select tests.ok((select balance from public.subscribers where id = tests.id('s')) = 25000 - 15000 - 4000,
  'void renewal: balance back to the first period (6,000)');

-- ---------------- history ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select tests.ok((select count(*) from public.subscriber_history(tests.id('s')) where reason like 'تصحيح مبلغ الوصل%') >= 2, 'history: shows corrections');
select tests.ok((select count(*) from public.subscriber_history(tests.id('s')) where table_name = 'subscribers' and actor_name = 'موظف مخوّل') >= 1, 'history: shows editor name');
select tests.ok((select count(*) from public.subscriber_history(tests.id('s')) where reason = 'مدة 60 يوم') = 1, 'history: shows date change reason');
select tests.ok((public.export_backup()->'payments'->0) ? 'corrects_payment_id', 'backup: includes the correction link');
reset role;
rollback;
