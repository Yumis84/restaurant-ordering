-- DRAFT ONLY. Fixes PIN lockout persistence.
-- Credential failures RETURN ok=false instead of raising after an UPDATE,
-- because an exception would roll back failure-counter writes.

begin;

drop function if exists public.staff_verify_pin(text,text);

create function public.staff_verify_pin(
  p_staff_code text,
  p_pin text
)
returns table(ok boolean, staff_id uuid, display_name text, error_code text)
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
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  select * into v_user
  from public.staff_users
  where lower(staff_code)=v_code
  for update;

  if not found or not v_user.active then
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  if v_user.locked_until is not null and v_user.locked_until > v_now then
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  if crypt(p_pin,v_user.pin_hash) <> v_user.pin_hash then
    v_failures := v_user.pin_failures + 1;
    update public.staff_users
    set pin_failures=v_failures,
        locked_until=case when v_failures>=5 then v_now+interval '15 minutes' else null end,
        updated_at=v_now
    where id=v_user.id;

    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  update public.staff_users
  set pin_failures=0,locked_until=null,last_login_at=v_now,updated_at=v_now
  where id=v_user.id;

  return query select true,v_user.id,v_user.display_name,null::text;
end;
$$;

revoke all on function public.staff_verify_pin(text,text) from public,anon,authenticated;
grant execute on function public.staff_verify_pin(text,text) to service_role;

commit;
