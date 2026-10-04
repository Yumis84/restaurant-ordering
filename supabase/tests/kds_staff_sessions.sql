-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Verifies server-side session storage semantics. Entire harness rolls back.

begin;

do $$
declare
  v_location uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_token_hash text := encode(digest('test-session-token','sha256'),'hex');
  v_session uuid;
  v_count integer;
begin
  insert into public.locations(id,slug,name,active)
  values(v_location,'kds-session-'||substr(v_location::text,1,8),'KDS session test',true);

  insert into public.staff_users(id,display_name,pin_hash)
  values(v_staff,'Session Test',crypt('4826',gen_salt('bf',4)));

  insert into public.staff_location_memberships(staff_id,location_id)
  values(v_staff,v_location);

  insert into public.staff_sessions(staff_id,token_hash,expires_at)
  values(v_staff,v_token_hash,clock_timestamp()+interval '12 hours')
  returning id into v_session;

  select count(*) into v_count from public.staff_sessions
  where id=v_session
    and token_hash=v_token_hash
    and revoked_at is null
    and expires_at>clock_timestamp();
  if v_count<>1 then raise exception 'active session not resolvable'; end if;

  update public.staff_sessions set revoked_at=clock_timestamp() where id=v_session;
  select count(*) into v_count from public.staff_sessions
  where id=v_session and revoked_at is null and expires_at>clock_timestamp();
  if v_count<>0 then raise exception 'revoked session remained active'; end if;

  update public.staff_sessions
  set revoked_at=null, expires_at=clock_timestamp()-interval '1 second'
  where id=v_session;
  select count(*) into v_count from public.staff_sessions
  where id=v_session and revoked_at is null and expires_at>clock_timestamp();
  if v_count<>0 then raise exception 'expired session remained active'; end if;
end $$;

rollback;
