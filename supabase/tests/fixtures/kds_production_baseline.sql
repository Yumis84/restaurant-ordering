-- ISOLATED ACCEPTANCE FIXTURE ONLY. NEVER APPLY TO PRODUCTION.
-- Minimal representation of the already-live schema required by KDS draft
-- migrations/tests. The canonical production baseline is not reconstructible
-- from this repository because the 2026-10-01 files are historical markers.

create extension if not exists pgcrypto;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true),''),
    nullif(current_setting('role', true),''),
    'anon'
  );
$$;

create table public.locations(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders(
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  order_number bigint generated always as identity,
  public_token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending'
    check(status in ('pending','accepted','preparing','ready','completed','rejected','cancelled')),
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_status_history(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now()
);

-- Production already has this trigger. B1 deliberately relies on it as the
-- sole history writer before B2 upgrades its metadata/revision semantics.
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.updated_at=now();
  if new.status is distinct from old.status then
    insert into public.order_status_history(order_id,status)
    values(new.id,new.status);
  end if;
  return new;
end;
$$;

create trigger trg_order_status_history
before update of status on public.orders
for each row execute function public.log_order_status_change();
