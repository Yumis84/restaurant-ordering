-- REVIEW CANDIDATE. Do not apply to production without explicit owner approval.
-- Consolidated KDS staff identity, membership, session and code+PIN authentication.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  staff_code text,
  display_name text not null,
  pin_hash text not null,
  active boolean not null default true,
  pin_failures integer not null default 0 check (pin_failures >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_staff_users_staff_code_ci
  on public.staff_users(lower(staff_code)) where staff_code is not null;

alter table public.staff_users drop constraint if exists staff_users_staff_code_format;
alter table public.staff_users add constraint staff_users_staff_code_format
  check (staff_code is null or staff_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$');

create table if not exists public.staff_location_memberships (
  staff_id uuid not null references public.staff_users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  role text not null default 'staff' check (role in ('staff','manager','owner')),
  active boolean not null default true,
  primary key (staff_id,location_id)
);

create table if not exists public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_users(id) on delete cascade,
  token_hash text not null unique,
  device_id_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists idx_staff_sessions_staff_active
  on public.staff_sessions(staff_id,expires_at) where revoked_at is null;

alter table public.staff_users enable row level security;
alter table public.staff_location_memberships enable row level security;
alter table public.staff_sessions enable row level security;

revoke all on public.staff_users from public,anon,authenticated;
revoke all on public.staff_location_memberships from public,anon,authenticated;
revoke all on public.staff_sessions from public,anon,authenticated;
grant select,insert,update on public.staff_users to service_role;
grant select,insert,update,delete on public.staff_location_memberships to service_role;
grant select,insert,update,delete on public.staff_sessions to service_role;

drop function if exists public.staff_verify_pin(text,text);
create function public.staff_verify_pin(p_staff_code text,p_pin text)
returns table(ok boolean,staff_id uuid,display_name text,error_code text)
language plpgsql security definer set search_path=public,extensions
as $$
declare
  v_user public.staff_users%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_failures integer;
  v_code text:=lower(btrim(coalesce(p_staff_code,'')));
  v_dummy_hash constant text:='$2a$12$C6UzMDM.H6dfI/f/IKcEe.1aHkVRk6PjQzYvE0j2gq8nJmV0H9C2W';
begin
  if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
  if length(v_code)<3 or length(v_code)>32 or p_pin is null or p_pin !~ '^[0-9]{6,12}$' then
    perform crypt(coalesce(p_pin,''),v_dummy_hash);
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text; return;
  end if;

  select * into v_user from public.staff_users where lower(staff_code)=v_code for update;
  if not found or not v_user.active then
    perform crypt(p_pin,v_dummy_hash);
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text; return;
  end if;
  if v_user.locked_until is not null and v_user.locked_until>v_now then
    perform crypt(p_pin,v_user.pin_hash);
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text; return;
  end if;
  if crypt(p_pin,v_user.pin_hash)<>v_user.pin_hash then
    v_failures:=v_user.pin_failures+1;
    update public.staff_users set pin_failures=v_failures,
      locked_until=case when v_failures>=5 then v_now+interval '15 minutes' else null end,
      updated_at=v_now where id=v_user.id;
    return query select false,null::uuid,null::text,'INVALID_CREDENTIALS'::text; return;
  end if;

  update public.staff_users set pin_failures=0,locked_until=null,last_login_at=v_now,updated_at=v_now where id=v_user.id;
  return query select true,v_user.id,v_user.display_name,null::text;
end;
$$;

revoke all on function public.staff_verify_pin(text,text) from public,anon,authenticated;
grant execute on function public.staff_verify_pin(text,text) to service_role;

commit;
