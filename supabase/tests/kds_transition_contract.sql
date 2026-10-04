-- KDS transition contract acceptance harness.
-- Run ONLY against an isolated disposable database after applying the draft migration.
-- This file intentionally wraps all fixture changes in a transaction and rolls back.

begin;

do $$
declare
  v_location uuid;
  v_order uuid;
  v_request uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_status text;
  v_revision bigint;
  v_count bigint;
begin
  insert into public.locations(slug, name, active)
  values ('kds-contract-test-' || replace(gen_random_uuid()::text, '-', ''), 'KDS contract test', true)
  returning id into v_location;

  -- order_number is GENERATED ALWAYS AS IDENTITY in the production schema,
  -- so it is deliberately omitted here.
  insert into public.orders(location_id, status, total)
  values (v_location, 'pending', 0)
  returning id into v_order;

  -- Initial orders start at revision 0.
  select revision into v_revision from public.orders where id = v_order;
  if v_revision <> 0 then raise exception 'ASSERT initial revision: %', v_revision; end if;

  -- Simulate service_role because the canonical RPC is intentionally backend-only.
  -- auth.role() in Supabase reads request.jwt.claim.role first.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  if auth.role() <> 'service_role' then
    raise exception 'ASSERT service_role simulation failed: %', auth.role();
  end if;

  select x.status, x.revision into v_status, v_revision
  from public.staff_transition_order(
    v_order, 'accepted', 'pending', 0, v_request,
    'staff', 'acceptance-test', 'kds', null
  ) x;

  if v_status <> 'accepted' or v_revision <> 1 then
    raise exception 'ASSERT accepted result: status %, revision %', v_status, v_revision;
  end if;

  select count(*) into v_count
  from public.order_status_history
  where order_id = v_order and status = 'accepted';

  if v_count <> 1 then
    raise exception 'ASSERT exactly one accepted history row: %', v_count;
  end if;

  -- Exact request replay must return the original transition result.
  select x.status, x.revision into v_status, v_revision
  from public.staff_transition_order(
    v_order, 'accepted', 'pending', 0, v_request,
    'staff', 'acceptance-test', 'kds', null
  ) x;

  if v_status <> 'accepted' or v_revision <> 1 then
    raise exception 'ASSERT deterministic replay: status %, revision %', v_status, v_revision;
  end if;

  select count(*) into v_count
  from public.order_status_history
  where order_id = v_order and request_id = v_request;

  if v_count <> 1 then
    raise exception 'ASSERT replay created duplicate history: %', v_count;
  end if;

  -- A stale client must not overwrite accepted.
  begin
    perform *
    from public.staff_transition_order(
      v_order, 'rejected', 'pending', 0, v_second,
      'staff', 'acceptance-test', 'kds', 'stale test'
    );
    raise exception 'ASSERT stale transition unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'ASSERT stale transition unexpectedly succeeded' then raise; end if;
      if sqlerrm not like '%ORDER_CONFLICT%' then raise; end if;
  end;

  -- Cancellation/rejection requires a reason.
  begin
    perform *
    from public.staff_transition_order(
      v_order, 'cancelled', 'accepted', 1, gen_random_uuid(),
      'staff', 'acceptance-test', 'kds', null
    );
    raise exception 'ASSERT cancellation without reason unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'ASSERT cancellation without reason unexpectedly succeeded' then raise; end if;
      if sqlerrm not like '%REASON_REQUIRED%' then raise; end if;
  end;

  -- Continue normal lifecycle and verify monotonic revision.
  select x.status, x.revision into v_status, v_revision
  from public.staff_transition_order(
    v_order, 'preparing', 'accepted', 1, gen_random_uuid(),
    'staff', 'acceptance-test', 'kds', null
  ) x;
  if v_revision <> 2 then raise exception 'ASSERT preparing revision: %', v_revision; end if;

  select x.status, x.revision into v_status, v_revision
  from public.staff_transition_order(
    v_order, 'ready', 'preparing', 2, gen_random_uuid(),
    'staff', 'acceptance-test', 'kds', null
  ) x;
  if v_revision <> 3 then raise exception 'ASSERT ready revision: %', v_revision; end if;

  select x.status, x.revision into v_status, v_revision
  from public.staff_transition_order(
    v_order, 'completed', 'ready', 3, gen_random_uuid(),
    'staff', 'acceptance-test', 'kds', null
  ) x;
  if v_revision <> 4 then raise exception 'ASSERT completed revision: %', v_revision; end if;

  select count(*) into v_count
  from public.order_status_history
  where order_id = v_order
    and status in ('accepted','preparing','ready','completed');

  if v_count <> 4 then
    raise exception 'ASSERT lifecycle history count: %', v_count;
  end if;
end
$$;

rollback;
