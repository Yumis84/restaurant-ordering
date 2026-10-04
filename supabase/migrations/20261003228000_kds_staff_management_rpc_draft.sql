-- DRAFT ONLY. Server-side service-role RPCs for scoped staff management.
-- Authorization of the acting manager is performed by the protected backend;
-- these RPCs additionally require service_role and explicit location ids.

begin;

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
  if p_pin is null or p_pin !~ '^[0-9]{4,12}$' then raise exception 'INVALID_PIN'; end if;
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

create or replace function public.staff_set_location_access(
  p_location_id uuid,
  p_staff_id uuid,
  p_active boolean
)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;

  update public.staff_location_memberships
  set active=p_active
  where location_id=p_location_id and staff_id=p_staff_id;

  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  if not p_active then
    update public.staff_sessions s
    set revoked_at=coalesce(s.revoked_at,now())
    where s.staff_id=p_staff_id and s.revoked_at is null;
  end if;
end;
$$;

revoke all on function public.staff_create_for_location(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.staff_create_for_location(uuid,text,text,text,text) to service_role;
revoke all on function public.staff_set_location_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.staff_set_location_access(uuid,uuid,boolean) to service_role;

commit;
