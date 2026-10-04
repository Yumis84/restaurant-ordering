-- DRAFT ONLY. Authentication hardening before KDS rollout.
-- Requires the staff auth/lockout drafts that precede this migration.
--
-- 1) Raises the staff PIN policy to 6-12 numeric digits.
-- 2) Performs a bcrypt check even for unknown/inactive staff codes to reduce
--    timing differences that could otherwise help enumerate staff accounts.

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
  -- Fixed bcrypt hash used only to equalize work for an unknown account.
  -- It is not a credential and never authenticates a user.
  v_dummy_hash constant text := '$2a$12$C6UzMDM.H6dfI/f/IKcEe.1aHkVRk6PjQzYvE0j2gq8nJmV0H9C2W';
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if length(v_code) < 3 or length(v_code) > 32
     or p_pin is null or p_pin !~ '^[0-9]{6,12}$' then
    -- Still do comparable bcrypt work for malformed credential attempts.
    perform crypt(coalesce(p_pin,''), v_dummy_hash);
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  select * into v_user
  from public.staff_users
  where lower(staff_code)=v_code
  for update;

  if not found or not v_user.active then
    perform crypt(p_pin, v_dummy_hash);
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text;
    return;
  end if;

  if v_user.locked_until is not null and v_user.locked_until > v_now then
    perform crypt(p_pin, v_user.pin_hash);
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

create or replace function public.staff_create_for_location(
  p_location_id uuid,
  p_staff_code text,
  p_display_name text,
  p_pin text,
  p_role text default 'staff'
)
returns table(staff_id uuid,staff_code text,display_name text,role text)
language plpgsql security definer set search_path=public,extensions
as $$
declare
  v_id uuid:=gen_random_uuid();
  v_code text:=lower(btrim(coalesce(p_staff_code,'')));
  v_name text:=btrim(coalesce(p_display_name,''));
begin
  if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.locations where id=p_location_id and active) then raise exception 'LOCATION_NOT_FOUND'; end if;
  if v_code !~ '^[a-z0-9][a-z0-9_-]{2,31}$' then raise exception 'INVALID_STAFF_CODE'; end if;
  if length(v_name)<1 or length(v_name)>80 then raise exception 'INVALID_DISPLAY_NAME'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6,12}$' then raise exception 'INVALID_PIN'; end if;
  if p_role not in ('staff','manager') then raise exception 'INVALID_ROLE'; end if;

  insert into public.staff_users(id,staff_code,display_name,pin_hash,active)
  values(v_id,v_code,v_name,crypt(p_pin,gen_salt('bf',12)),true);

  insert into public.staff_location_memberships(staff_id,location_id,role,active)
  values(v_id,p_location_id,p_role,true);

  return query select v_id,v_code,v_name,p_role;
exception when unique_violation then
  raise exception 'STAFF_CODE_EXISTS';
end;
$$;

revoke all on function public.staff_create_for_location(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.staff_create_for_location(uuid,text,text,text,text) to service_role;

commit;
