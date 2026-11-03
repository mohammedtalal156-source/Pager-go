-- Phase 12: «الكابينات» list of poles. Additive only: subscriber rows are not touched.
-- A pole is shown in «الكابينات» when it is in this list or when a subscriber uses it.
-- Removing a pole only hides it from the list (no rows are deleted) and is refused
-- while any subscriber is still on it.

create table public.poles (
  name       text primary key check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id)
);

alter table public.poles enable row level security;
create policy poles_select on public.poles for select to authenticated using (private.is_staff());
revoke insert, update, delete on public.poles from anon, authenticated;
grant select on public.poles to authenticated;

create trigger audit_poles after insert or update or delete on public.poles for each row execute function public.audit_row_change();
create trigger poles_no_delete before delete on public.poles for each row execute function public.forbid_delete();

insert into public.poles (name) select g::text from generate_series(1, 50) g;

-- Subscribers (not deleted, archived included) on a pole: the «العامود» field,
-- or «عامود N» written in the name for older subscribers.
create or replace function private.pole_subscriber_count(p_name text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.subscribers s
  where s.deleted_at is null
    and (s.pole = p_name
      or (s.pole is null and s.search_text ~ ('(^|\s)(ال)?(عامود|عمود)\s+' || regexp_replace(p_name, '([^[:alnum:]])', '\\\1', 'g') || '(\s|$)')));
$$;

create or replace function public.add_pole(p_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '^(ال)?(عامود|عمود)\s*', '')), '');
begin
  if not private.is_admin() then
    raise exception 'إضافة العواميد متاحة للمدير فقط' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 50 then
    raise exception 'اكتب رقم العامود' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poles where name = v_name and hidden_at is null) then
    raise exception 'عامود % موجود', v_name using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', 'إضافة عامود', true);
  insert into public.poles (name, created_by) values (v_name, auth.uid())
  on conflict (name) do update set hidden_at = null, hidden_by = null;
  return json_build_object('name', v_name);
end;
$$;

create or replace function public.remove_pole(p_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not private.is_admin() then
    raise exception 'حذف العواميد متاح للمدير فقط' using errcode = '42501';
  end if;
  if not exists (select 1 from public.poles where name = p_name and hidden_at is null) then
    raise exception 'العامود غير موجود' using errcode = 'P0001';
  end if;
  v_count := private.pole_subscriber_count(p_name);
  if v_count > 0 then
    raise exception 'لا يمكن حذف عامود % لأن عليه % مشترك. انقلهم لعامود آخر من «تعديل المشترك» أولاً', p_name, v_count using errcode = 'P0001';
  end if;
  perform set_config('app.audit_reason', 'حذف عامود', true);
  update public.poles set hidden_at = now(), hidden_by = auth.uid() where name = p_name;
  return json_build_object('name', p_name);
end;
$$;

revoke all on function private.pole_subscriber_count(text) from public, anon, authenticated;
revoke all on function public.add_pole(text) from public, anon;
revoke all on function public.remove_pole(text) from public, anon;
grant execute on function public.add_pole(text) to authenticated;
grant execute on function public.remove_pole(text) to authenticated;
