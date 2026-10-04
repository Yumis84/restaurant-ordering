-- ISOLATED/DISPOSABLE DATABASE ONLY.
-- Requires Phase A + B1 + B2 drafts. Entire harness rolls back.

begin;

do $$
declare
  v_location uuid:=gen_random_uuid();
  v_order uuid:=gen_random_uuid();
  v_request uuid:=gen_random_uuid();
  v_revision bigint;
  v_count integer;
begin
  insert into public.locations(id,slug,name,active)
  values(v_location,'kds-b2-'||substr(v_location::text,1,8),'KDS B2 test',true);

  insert into public.orders(id,location_id,status,total)
  values(v_order,v_location,'pending',100);

  perform set_config('request.jwt.claim.role','service_role',true);

  -- Canonical KDS path: pending -> accepted, revision 0 -> 1.
  perform public.staff_transition_order(
    v_order,'accepted','pending',0,v_request,'staff','test-staff','kds',null
  );

  select revision into v_revision from public.orders where id=v_order;
  if v_revision<>1 then raise exception 'canonical revision expected 1 got %',v_revision; end if;

  select count(*) into v_count from public.order_status_history
  where order_id=v_order and status='accepted' and request_id=v_request
    and from_status='pending' and revision=1 and channel='kds';
  if v_count<>1 then raise exception 'canonical audit row missing'; end if;

  -- Idempotent replay must not add history.
  perform public.staff_transition_order(
    v_order,'accepted','pending',0,v_request,'staff','test-staff','kds',null
  );
  select count(*) into v_count from public.order_status_history
  where order_id=v_order and request_id=v_request;
  if v_count<>1 then raise exception 'idempotent replay duplicated history'; end if;

  -- Legacy Telegram path remains callable during B2 coexistence.
  perform public.staff_set_order_status(v_order,'preparing');
  select revision into v_revision from public.orders where id=v_order;
  if v_revision<>2 then raise exception 'legacy path did not advance revision'; end if;

  select count(*) into v_count from public.order_status_history
  where order_id=v_order and status='preparing' and revision=2;
  if v_count<>1 then raise exception 'legacy transition history not exactly one'; end if;

  -- Stale canonical client must conflict after Telegram changed the order.
  begin
    perform public.staff_transition_order(
      v_order,'ready','accepted',1,gen_random_uuid(),'staff','test-staff','kds',null
    );
    raise exception 'stale canonical transition unexpectedly succeeded';
  exception when others then
    if sqlerrm='stale canonical transition unexpectedly succeeded' then raise; end if;
    if sqlerrm<>'ORDER_CONFLICT' then raise; end if;
  end;

  -- Reconciled canonical request succeeds.
  perform public.staff_transition_order(
    v_order,'ready','preparing',2,gen_random_uuid(),'staff','test-staff','kds',null
  );

  select revision into v_revision from public.orders where id=v_order;
  if v_revision<>3 then raise exception 'reconciled canonical revision expected 3'; end if;
end $$;

rollback;
