-- ISOLATED/DISPOSABLE DATABASE ONLY. Entire harness rolls back.
-- Requires the B1 review migration and the existing order status history trigger.

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

  insert into public.orders(id,location_id,public_token,status,total,payment_method)
  values(v_order,v_location,gen_random_uuid(),'pending',0,'cash');

  select count(*) into v_before from public.order_status_history where order_id=v_order;

  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.staff_set_order_status(v_order,'accepted');

  select status into v_status from public.orders where id=v_order;
  if v_status <> 'accepted' then raise exception 'status transition failed'; end if;

  select count(*) into v_after from public.order_status_history where order_id=v_order;
  if v_after-v_before <> 1 then
    raise exception 'expected exactly one history row, got %',v_after-v_before;
  end if;

  begin
    perform public.staff_set_order_status(v_order,'ready');
    raise exception 'illegal transition unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'illegal transition unexpectedly succeeded' then raise; end if;
  end;

  select status into v_status from public.orders where id=v_order;
  if v_status <> 'accepted' then raise exception 'illegal transition mutated order'; end if;
end $$;

rollback;
