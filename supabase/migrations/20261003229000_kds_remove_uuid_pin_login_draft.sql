-- DRAFT ONLY. Final auth cleanup before KDS rollout.
-- Requires staff_code auth and persistent lockout migrations.
-- Production remains untouched until the rollout is explicitly approved.

begin;

revoke all on function public.staff_verify_pin(uuid,text)
  from public, anon, authenticated, service_role;

drop function if exists public.staff_verify_pin(uuid,text);

commit;

-- Canonical staff authentication after this migration:
-- public.staff_verify_pin(text,text) -> staff_code + PIN
