-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Requires staff auth + staff-code + lockout-fix drafts. Entire harness rolls back.

begin;

do $$
declare
  v_location uuid:=gen_random_uuid();
  v_staff uuid:=gen_random_uuid();
  v_count integer;
  v_failures integer;
  v_locked timestamptz;
  v_ok boolean;
begin
  insert into public.locations(id,slug,name,active)
  values(v_location,'staff-auth-'||substr(v_location::text,1,8),'Staff auth test',true);

  insert into public.staff_users(id,display_name,staff_code,pin_hash)
  values(v_staff,'KDS Test Staff','cook-01',crypt('482619',gen_salt('bf',4)));

  insert into public.staff_location_memberships(staff_id,location_id,role,active)
  values(v_staff,v_location,'staff',true);

  perform set_config('request.jwt.claim.role','service_role',true);

  select r.ok into v_ok from public.staff_verify_pin('cook-01','482619') r;
  if v_ok is distinct from true then raise exception 'correct credentials failed'; end if;

  select r.ok into v_ok from public.staff_verify_pin('  COOK-01  ','482619') r;
  if v_ok is distinct from true then raise exception 'normalized code failed'; end if;

  select r.ok into v_ok from public.staff_verify_pin('missing-user','482619') r;
  if v_ok is distinct from false then raise exception 'unknown code unexpectedly authenticated'; end if;

  select r.ok into v_ok from public.staff_verify_pin('cook-01','4826') r;
  if v_ok is distinct from false then raise exception 'legacy 4-digit PIN unexpectedly authenticated'; end if;

  -- Wrong PIN writes must persist; no exception may roll them back.
  for v_count in 1..4 loop
    select r.ok into v_ok from public.staff_verify_pin('cook-01','000000') r;
    if v_ok is distinct from false then raise exception 'wrong PIN unexpectedly authenticated'; end if;
    select pin_failures,locked_until into v_failures,v_locked
    from public.staff_users where id=v_staff;
    if v_failures<>v_count then raise exception 'failure count expected %, got %',v_count,v_failures; end if;
    if v_locked is not null then raise exception 'locked before fifth failure'; end if;
  end loop;

  select r.ok into v_ok from public.staff_verify_pin('cook-01','000000') r;
  select pin_failures,locked_until into v_failures,v_locked
  from public.staff_users where id=v_staff;
  if v_ok is distinct from false or v_failures<>5 or v_locked is null then
    raise exception 'fifth failure did not persist lockout';
  end if;

  select r.ok into v_ok from public.staff_verify_pin('cook-01','482619') r;
  if v_ok is distinct from false then raise exception 'locked account authenticated'; end if;

  update public.staff_users set locked_until=clock_timestamp()-interval '1 second' where id=v_staff;
  select r.ok into v_ok from public.staff_verify_pin('cook-01','482619') r;
  if v_ok is distinct from true then raise exception 'expired lock did not authenticate'; end if;

  select pin_failures,locked_until into v_failures,v_locked
  from public.staff_users where id=v_staff;
  if v_failures<>0 or v_locked is not null then raise exception 'successful login did not reset lockout'; end if;
end $$;

rollback;
