-- ISOLATED/DISPOSABLE DATABASE ONLY. Entire harness rolls back.
begin;
do $$
declare
 v_location uuid:=gen_random_uuid(); v_staff uuid:=gen_random_uuid();
 v_i integer; v_failures integer; v_locked timestamptz; v_ok boolean;
begin
 insert into public.locations(id,slug,name,active) values(v_location,'auth-'||substr(v_location::text,1,8),'Auth test',true);
 insert into public.staff_users(id,staff_code,display_name,pin_hash)
 values(v_staff,'cook-01','KDS Test',crypt('482619',gen_salt('bf',4)));
 insert into public.staff_location_memberships(staff_id,location_id) values(v_staff,v_location);
 perform set_config('request.jwt.claim.role','service_role',true);

 select r.ok into v_ok from public.staff_verify_pin(' COOK-01 ','482619') r;
 if v_ok is distinct from true then raise exception 'valid login failed'; end if;
 select r.ok into v_ok from public.staff_verify_pin('missing','482619') r;
 if v_ok is distinct from false then raise exception 'unknown login succeeded'; end if;
 select r.ok into v_ok from public.staff_verify_pin('cook-01','4826') r;
 if v_ok is distinct from false then raise exception 'short PIN succeeded'; end if;

 for v_i in 1..5 loop
   select r.ok into v_ok from public.staff_verify_pin('cook-01','000000') r;
   if v_ok is distinct from false then raise exception 'wrong PIN succeeded'; end if;
 end loop;
 select pin_failures,locked_until into v_failures,v_locked from public.staff_users where id=v_staff;
 if v_failures<>5 or v_locked is null then raise exception 'lockout did not persist'; end if;
 select r.ok into v_ok from public.staff_verify_pin('cook-01','482619') r;
 if v_ok is distinct from false then raise exception 'locked login succeeded'; end if;
 update public.staff_users set locked_until=clock_timestamp()-interval '1 second' where id=v_staff;
 select r.ok into v_ok from public.staff_verify_pin('cook-01','482619') r;
 if v_ok is distinct from true then raise exception 'expired lock failed'; end if;
end $$;
rollback;
