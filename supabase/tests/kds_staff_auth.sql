-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Requires KDS staff auth draft migrations.
-- Entire harness rolls back.

begin;

do $$
declare
  v_location uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_other_location uuid := gen_random_uuid();
  v_count integer;
  v_failures integer;
  v_locked timestamptz;
begin
  insert into public.locations(id, slug, name, active)
  values
    (v_location, 'kds-auth-test-a-' || substr(v_location::text,1,8), 'KDS auth test A', true),
    (v_other_location, 'kds-auth-test-b-' || substr(v_other_location::text,1,8), 'KDS auth test B', true);

  insert into public.staff_users(id, display_name, pin_hash)
  values (v_staff, 'KDS Test Staff', crypt('4826', gen_salt('bf', 4)));

  insert into public.staff_location_memberships(staff_id, location_id)
  values (v_staff, v_location);

  perform set_config('request.jwt.claim.role','service_role',true);

  -- Correct PIN succeeds.
  select count(*) into v_count
  from public.staff_verify_pin(v_staff, '4826');
  if v_count <> 1 then raise exception 'correct PIN did not authenticate'; end if;

  -- Four failures do not lock.
  for i in 1..4 loop
    begin
      perform public.staff_verify_pin(v_staff, '0000');
    exception when others then
      if sqlerrm <> 'INVALID_CREDENTIALS' then raise; end if;
    end;
  end loop;

  select pin_failures, locked_until into v_failures, v_locked
  from public.staff_users where id=v_staff;
  if v_failures <> 4 or v_locked is not null then
    raise exception 'unexpected pre-lock state failures=% locked=%',v_failures,v_locked;
  end if;

  -- Fifth failure locks for a bounded interval.
  begin
    perform public.staff_verify_pin(v_staff, '0000');
  exception when others then
    if sqlerrm <> 'INVALID_CREDENTIALS' then raise; end if;
  end;

  select pin_failures, locked_until into v_failures, v_locked
  from public.staff_users where id=v_staff;
  if v_failures <> 5 or v_locked is null or v_locked <= clock_timestamp() then
    raise exception 'lockout not applied';
  end if;

  -- Correct PIN is rejected while locked.
  begin
    perform public.staff_verify_pin(v_staff, '4826');
    raise exception 'locked account authenticated';
  exception when others then
    if sqlerrm = 'locked account authenticated' then raise; end if;
    if sqlerrm <> 'INVALID_CREDENTIALS' then raise; end if;
  end;

  -- Simulate lock expiry; correct PIN resets counters.
  update public.staff_users set locked_until=clock_timestamp()-interval '1 second' where id=v_staff;
  perform public.staff_verify_pin(v_staff, '4826');

  select pin_failures, locked_until into v_failures, v_locked
  from public.staff_users where id=v_staff;
  if v_failures <> 0 or v_locked is not null then
    raise exception 'successful auth did not reset lock state';
  end if;

  -- Membership remains scoped to exactly one authorized location.
  select count(*) into v_count
  from public.staff_location_memberships
  where staff_id=v_staff and active and location_id=v_location;
  if v_count <> 1 then raise exception 'authorized location missing'; end if;

  select count(*) into v_count
  from public.staff_location_memberships
  where staff_id=v_staff and active and location_id=v_other_location;
  if v_count <> 0 then raise exception 'unauthorized location leaked'; end if;
end $$;

rollback;
