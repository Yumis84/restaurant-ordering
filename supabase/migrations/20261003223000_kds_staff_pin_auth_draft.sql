-- DRAFT ONLY. Requires 20261003222000_kds_staff_auth_draft.sql.
-- Do not apply to production without isolated acceptance tests.

begin;

alter table public.staff_users
  add column if not exists pin_failures integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add constraint staff_users_pin_failures_nonnegative check (pin_failures >= 0);

create or replace function public.staff_verify_pin(
  p_staff_id uuid,
  p_pin text
)
returns table(staff_id uuid, display_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.staff_users%rowtype;
  v_now timestamptz := clock_timestamp();
  v_failures integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if p_pin is null or length(p_pin) < 4 or length(p_pin) > 12 then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  select * into v_user
  from public.staff_users
  where id = p_staff_id
  for update;

  if not found or not v_user.active then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  if v_user.locked_until is not null and v_user.locked_until > v_now then
    raise exception 'INVALID_CREDENTIALS';
  end if;

  if crypt(p_pin, v_user.pin_hash) <> v_user.pin_hash then
    v_failures := v_user.pin_failures + 1;

    update public.staff_users
    set pin_failures = v_failures,
        locked_until = case
          when v_failures >= 5 then v_now + interval '15 minutes'
          else null
        end,
        updated_at = v_now
    where id = v_user.id;

    raise exception 'INVALID_CREDENTIALS';
  end if;

  update public.staff_users
  set pin_failures = 0,
      locked_until = null,
      last_login_at = v_now,
      updated_at = v_now
  where id = v_user.id;

  return query select v_user.id, v_user.display_name;
end;
$$;

revoke all on function public.staff_verify_pin(uuid,text) from public, anon, authenticated;
grant execute on function public.staff_verify_pin(uuid,text) to service_role;

commit;

-- Provisioning example for an isolated environment only:
-- crypt(:pin, gen_salt('bf', 12))
-- Never commit a real PIN or its reusable plaintext representation.
