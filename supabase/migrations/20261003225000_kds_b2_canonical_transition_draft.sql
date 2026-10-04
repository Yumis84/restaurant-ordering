-- DRAFT ONLY. B2 follows Phase A additive schema + B1 single-writer RPC.
-- Installs canonical revision/idempotency/audit semantics while keeping the
-- legacy staff_set_order_status(uuid,text) callable for Telegram.
-- Do not apply to production without isolated acceptance and explicit approval.

begin;

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_actor_type text;
  v_actor_id text;
  v_channel text;
  v_reason text;
begin
  new.updated_at = now();

  if new.status is distinct from old.status then
    new.revision = old.revision + 1;

    v_request_id := nullif(current_setting('app.transition_request_id', true), '')::uuid;
    v_actor_type := nullif(current_setting('app.transition_actor_type', true), '');
    v_actor_id := nullif(current_setting('app.transition_actor_id', true), '');
    v_channel := nullif(current_setting('app.transition_channel', true), '');
    v_reason := nullif(current_setting('app.transition_reason', true), '');

    insert into public.order_status_history(
      order_id,status,from_status,revision,request_id,
      actor_type,actor_id,channel,reason
    ) values (
      new.id,new.status,old.status,new.revision,v_request_id,
      v_actor_type,v_actor_id,v_channel,v_reason
    );
  end if;

  return new;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid,
  p_to_status text,
  p_expected_status text,
  p_expected_revision bigint,
  p_request_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_channel text,
  p_reason text default null
)
returns table(id uuid,status text,revision bigint,updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_status_history%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if p_channel not in ('kds','telegram','admin') then raise exception 'INVALID_CHANNEL'; end if;
  if p_actor_type not in ('staff','telegram','system','admin') then raise exception 'INVALID_ACTOR_TYPE'; end if;

  -- Fast replay check. The unique partial index is the final concurrency guard.
  select * into v_existing
  from public.order_status_history
  where order_id=p_order_id and request_id=p_request_id
  limit 1;

  if found then
    return query
      select v_existing.order_id,v_existing.status,v_existing.revision,v_existing.created_at;
    return;
  end if;

  select * into v_order
  from public.orders
  where orders.id=p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  -- Re-check replay after the order lock: another request may have completed
  -- while this transaction waited.
  select * into v_existing
  from public.order_status_history
  where order_id=p_order_id and request_id=p_request_id
  limit 1;

  if found then
    return query
      select v_existing.order_id,v_existing.status,v_existing.revision,v_existing.created_at;
    return;
  end if;

  if v_order.status is distinct from p_expected_status
     or v_order.revision is distinct from p_expected_revision then
    raise exception 'ORDER_CONFLICT';
  end if;

  if not (
    (v_order.status='pending' and p_to_status in ('accepted','rejected','cancelled')) or
    (v_order.status='accepted' and p_to_status in ('preparing','cancelled')) or
    (v_order.status='preparing' and p_to_status in ('ready','cancelled')) or
    (v_order.status='ready' and p_to_status in ('completed','cancelled'))
  ) then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  if p_to_status in ('rejected','cancelled')
     and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  perform set_config('app.transition_request_id',p_request_id::text,true);
  perform set_config('app.transition_actor_type',coalesce(p_actor_type,''),true);
  perform set_config('app.transition_actor_id',coalesce(p_actor_id,''),true);
  perform set_config('app.transition_channel',coalesce(p_channel,''),true);
  perform set_config('app.transition_reason',coalesce(p_reason,''),true);

  update public.orders set status=p_to_status where orders.id=p_order_id;

  return query
    select o.id,o.status,o.revision,o.updated_at
    from public.orders o where o.id=p_order_id;
end;
$$;

revoke all on function public.staff_transition_order(
  uuid,text,text,bigint,uuid,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.staff_transition_order(
  uuid,text,text,bigint,uuid,text,text,text,text
) to service_role;

commit;
