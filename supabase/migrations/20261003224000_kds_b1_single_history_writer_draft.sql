-- DRAFT ONLY. Backward-compatible B1 cutover.
-- Purpose: stop duplicate order_status_history rows without changing the
-- legacy Telegram RPC signature or lifecycle.
-- Do not apply to production without explicit approval and regression checks.

begin;

create or replace function public.staff_set_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if p_status not in ('accepted','preparing','ready','completed','rejected','cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  if not (
    (v_order.status = 'pending' and p_status in ('accepted','rejected','cancelled')) or
    (v_order.status = 'accepted' and p_status in ('preparing','cancelled')) or
    (v_order.status = 'preparing' and p_status in ('ready','cancelled')) or
    (v_order.status = 'ready' and p_status in ('completed','cancelled'))
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;

  -- The existing BEFORE UPDATE trigger trg_order_status_history is the sole
  -- history writer in B1. Do not INSERT order_status_history here.
  update public.orders
  set status = p_status,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'updated_at', v_order.updated_at
  );
end;
$$;

revoke all on function public.staff_set_order_status(uuid,text) from public, anon, authenticated;
grant execute on function public.staff_set_order_status(uuid,text) to service_role;

commit;
