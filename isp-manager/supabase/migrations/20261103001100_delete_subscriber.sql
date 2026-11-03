-- Phase 10: admin can permanently delete a subscriber with all their
-- periods, renewals, payments and debt adjustments.
--
-- Deleting stays impossible everywhere else: clients have no DELETE
-- privilege, and the forbid_delete() triggers only let rows through while
-- delete_subscriber() has set a transaction-local flag. Expenses and the
-- audit log can never be deleted. Each deleted row is still written to
-- audit_logs (action DELETE, with the old data and the reason).

create or replace function public.forbid_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name in ('subscribers', 'subscriptions', 'payments', 'renewals', 'debt_adjustments')
     and current_setting('app.allow_subscriber_delete', true) = 'on' then
    return old;
  end if;
  raise exception 'حذف السجلات من الجدول % غير مسموح', tg_table_name
    using errcode = '42501';
end;
$$;

create or replace function public.delete_subscriber(p_subscriber_id uuid, p_confirm text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscribers%rowtype;
  v_pay int;
  v_paid bigint;
  v_periods int;
begin
  if not private.is_admin() then
    raise exception 'حذف المشتركين متاح للمدير فقط' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'حذف' then
    raise exception 'اكتب كلمة «حذف» للتأكيد' using errcode = 'P0001';
  end if;
  select * into s from public.subscribers where id = p_subscriber_id for update;
  if not found then
    raise exception 'المشترك غير موجود أو محذوف مسبقاً' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(amount) filter (where not is_voided), 0) into v_pay, v_paid
  from public.payments where subscriber_id = s.id;
  select count(*) into v_periods from public.subscriptions where subscriber_id = s.id;

  perform set_config('app.audit_reason', format('حذف المشترك #%s (%s) مع اشتراكاته ومدفوعاته', s.code, s.full_name), true);
  perform set_config('app.allow_subscriber_delete', 'on', true);

  -- children first (foreign keys), then the subscriber
  delete from public.renewals where subscriber_id = s.id;
  delete from public.payments where subscriber_id = s.id and corrects_payment_id is not null;
  delete from public.payments where subscriber_id = s.id;
  delete from public.debt_adjustments where subscriber_id = s.id;
  delete from public.subscriptions where subscriber_id = s.id;
  delete from public.subscribers where id = s.id;

  perform set_config('app.allow_subscriber_delete', 'off', true);

  return json_build_object('code', s.code, 'full_name', s.full_name, 'payments', v_pay,
    'paid', v_paid, 'periods', v_periods);
end;
$$;

revoke all on function public.delete_subscriber(uuid, text) from public, anon;
grant execute on function public.delete_subscriber(uuid, text) to authenticated;
