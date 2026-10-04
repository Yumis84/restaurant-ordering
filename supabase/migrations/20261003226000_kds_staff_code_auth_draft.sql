-- DRAFT ONLY. Evolves staff login from UUID bootstrap to staff code + PIN.
-- Requires prior staff auth drafts. Do not apply to production without acceptance.

begin;

alter table public.staff_users
  add column if not exists staff_code text;

create unique index if not exists uq_staff_users_staff_code_ci
  on public.staff_users(lower(staff_code))
  where staff_code is not null;

alter table public.staff_users
  drop constraint if exists staff_users_staff_code_format;

alter table public.staff_users
  add constraint staff_users_staff_code_format
  check (
    staff_code is null or
    staff_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$'
  );

create or replace function public.staff_verify_pin(
  p_staff_code text,
  p_pin text
)
returns table(staff_id uuid, display_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.staff_users%rowtype;
  v_now timestamptz := clock_timestamp();
  v_failures integer;
  v_code text := lower(btrim(coalesce(p_staff_code,'')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(v_code) < 3 or length(v_code) > 32
     or p_pin is null or length(p_pin) < 4 or length(p_pin) > 12 then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  select * into v_user
  from public.staff_users
  where lower(staff_code)=v_code
  for update;

  if not found or not v_user.active then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  if v_user.locked_until is not null and v_user.locked_until > v_now then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  if crypt(p_pin,v_user.pin_hash) <> v_user.pin_hash then
    v_failures := v_user.pin_failures + 1;
    update public.staff_users
    set pin_failures=v_failures,
        locked_until=case when v_failures>=5 then v_now+interval '15 minutes' else null end,
        updated_at=v_now
    where id=v_user.id;
    raise exception 'INVALID_CREDENTIALS';
  end if;

  update public.staff_users
  set pin_failures=0,locked_until=null,last_login_at=v_now,updated_at=v_now
  where id=v_user.id;

  return query select v_user.id,v_user.display_name;
end;
$$;

revoke all on function public.staff_verify_pin(text,text) from public,anon,authenticated;
grant execute on function public.staff_verify_pin(text,text) to service_role;

-- Remove the temporary UUID-login overload once no isolated tests/clients use it.
-- Production rollout should not expose both signatures longer than necessary.

commit;
