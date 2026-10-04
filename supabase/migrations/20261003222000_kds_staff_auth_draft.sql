-- DRAFT ONLY. Do not apply to production without review and acceptance tests.
-- Server-side KDS staff identity/session model.

begin;

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_location_memberships (
  staff_id uuid not null references public.staff_users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  role text not null default 'staff' check (role in ('staff','manager','owner')),
  active boolean not null default true,
  primary key (staff_id, location_id)
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
  on public.staff_sessions(staff_id, expires_at)
  where revoked_at is null;

alter table public.staff_users enable row level security;
alter table public.staff_location_memberships enable row level security;
alter table public.staff_sessions enable row level security;

-- No browser policies. These tables are server-side only.
revoke all on public.staff_users from public, anon, authenticated;
revoke all on public.staff_location_memberships from public, anon, authenticated;
revoke all on public.staff_sessions from public, anon, authenticated;

grant select, insert, update on public.staff_users to service_role;
grant select, insert, update, delete on public.staff_location_memberships to service_role;
grant select, insert, update, delete on public.staff_sessions to service_role;

commit;
