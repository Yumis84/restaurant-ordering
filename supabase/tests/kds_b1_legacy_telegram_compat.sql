-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Requires production baseline + B1 single-history-writer draft.
-- Proves the legacy Telegram RPC signature still works and writes one history
-- row per transition. Entire harness rolls back.

begin;

do $$
declare
  v_location uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_before integer;
  v_after integer;
  v_status text;
begin
  insert into public.locations(id,slug,name,active)
  values(v_location,'kds-b1-'||substr(v_location::text,1,8),'KDS B1 test',true);

  insert into public.orders(id,location_id,status,total)
  values(v_order,v_location,'pending',100);

  select count(*) into v_before
  from public.order_status_history
  where order_id=v_order and status='accepted';

  perform set_config('request.jwt.claim.role','service_role',true);

  -- Same two-argument call shape used by the existing Telegram Edge Function.
  perform public.staff_set_order_status(v_order,'accepted');

  select status into v_status from public.orders where id=v_order;
  if v_status <> 'accepted' then
    raise exception 'legacy RPC did not update order';
  end if;

  select count(*) into v_after
  from public.order_status_history
  where order_id=v_order and status='accepted';

  if v_after - v_before <> 1 then
    raise exception 'expected exactly one accepted history row, got %',v_after-v_before;
  end if;

  perform public.staff_set_order_status(v_order,'preparing');
  perform public.staff_set_order_status(v_order,'ready');
  perform public.staff_set_order_status(v_order,'completed');

  select count(*) into v_after
  from public.order_status_history
  where order_id=v_order and status in ('accepted','preparing','ready','completed');

  if v_after <> 4 then
    raise exception 'expected exactly four lifecycle history rows, got %',v_after;
  end if;

  -- Existing lifecycle protection must remain intact.
  begin
    perform public.staff_set_order_status(v_order,'accepted');
    raise exception 'invalid reverse transition unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'invalid reverse transition unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'INVALID_TRANSITION' then raise; end if;
  end;
end $$;

rollback;
