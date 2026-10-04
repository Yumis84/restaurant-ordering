-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Requires staff auth, staff management, and auth-hardening drafts.
-- Entire harness runs in one transaction and rolls back.

begin;

do $$
declare
  v_location uuid:=gen_random_uuid();
  v_staff uuid;
  v_code text;
  v_name text;
  v_role text;
  v_hash text;
  v_membership_active boolean;
  v_revoked timestamptz;
  v_error text;
begin
  insert into public.locations(id,slug,name,active)
  values(v_location,'staff-mgmt-'||substr(v_location::text,1,8),'Staff management test',true);

  -- RPCs must not be callable as a normal authenticated user.
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform * from public.staff_create_for_location(v_location,'denied-01','Denied','482619','staff');
    raise exception 'non-service role unexpectedly created staff';
  exception when others then
    if sqlerrm not like '%FORBIDDEN%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.role','service_role',true);

  select r.staff_id,r.staff_code,r.display_name,r.role
  into v_staff,v_code,v_name,v_role
  from public.staff_create_for_location(v_location,'Cook-01','Cook One','482619','staff') r;

  if v_staff is null or v_code<>'cook-01' or v_name<>'Cook One' or v_role<>'staff' then
    raise exception 'created staff payload mismatch';
  end if;

  select pin_hash into v_hash from public.staff_users where id=v_staff;
  if v_hash is null or crypt('482619',v_hash)<>v_hash then
    raise exception 'staff PIN was not stored as a verifiable bcrypt hash';
  end if;
  if v_hash='482619' then raise exception 'plaintext PIN stored'; end if;

  select active into v_membership_active
  from public.staff_location_memberships
  where staff_id=v_staff and location_id=v_location and role='staff';
  if v_membership_active is distinct from true then
    raise exception 'active location membership missing';
  end if;

  -- Duplicate code is rejected.
  begin
    perform * from public.staff_create_for_location(v_location,'COOK-01','Duplicate','593721','staff');
    raise exception 'duplicate staff code unexpectedly accepted';
  exception when others then
    if sqlerrm not like '%STAFF_CODE_EXISTS%' then raise; end if;
  end;

  -- RPC itself rejects unsupported/owner escalation roles.
  begin
    perform * from public.staff_create_for_location(v_location,'owner-01','Owner Attempt','593721','owner');
    raise exception 'invalid owner role unexpectedly accepted';
  exception when others then
    if sqlerrm not like '%INVALID_ROLE%' then raise; end if;
  end;

  -- Current policy is 6-12 numeric digits.
  begin
    perform * from public.staff_create_for_location(v_location,'shortpin','Short PIN','1234','staff');
    raise exception 'legacy 4-digit PIN unexpectedly accepted';
  exception when others then
    if sqlerrm not like '%INVALID_PIN%' then raise; end if;
  end;

  insert into public.staff_sessions(staff_id,token_hash,expires_at)
  values(v_staff,encode(digest('staff-management-session','sha256'),'hex'),clock_timestamp()+interval '12 hours');

  perform public.staff_set_location_access(v_location,v_staff,false);

  select active into v_membership_active
  from public.staff_location_memberships
  where staff_id=v_staff and location_id=v_location;
  if v_membership_active is distinct from false then
    raise exception 'membership was not disabled';
  end if;

  select revoked_at into v_revoked
  from public.staff_sessions
  where staff_id=v_staff
  order by created_at desc limit 1;
  if v_revoked is null then raise exception 'disable did not revoke active session'; end if;

  perform public.staff_set_location_access(v_location,v_staff,true);
  select active into v_membership_active
  from public.staff_location_memberships
  where staff_id=v_staff and location_id=v_location;
  if v_membership_active is distinct from true then
    raise exception 'membership was not re-enabled';
  end if;
end $$;

rollback;
