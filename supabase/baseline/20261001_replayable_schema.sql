-- Shavalleya replayable baseline
-- Derived from the verified production contract on 2026-10-01.
create extension if not exists pgcrypto;

create table public.locations(id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,address text,active boolean not null default true,created_at timestamptz not null default now());
create table public.categories(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations(id) on delete cascade,name text not null,sort_order integer not null default 0,active boolean not null default true);
create table public.products(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations(id) on delete cascade,category_id uuid references public.categories(id) on delete set null,name text not null,description text,price numeric(10,2) not null check(price>=0),image_url text,available boolean not null default true,sort_order integer not null default 0);
create table public.modifier_groups(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations(id) on delete cascade,name text not null,min_select integer not null default 0 check(min_select>=0),max_select integer not null default 1,sort_order integer not null default 0,active boolean not null default true,check(max_select>=min_select));
create table public.modifiers(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.modifier_groups(id) on delete cascade,name text not null,price_delta numeric(10,2) not null default 0,available boolean not null default true,sort_order integer not null default 0);
create table public.product_modifier_groups(product_id uuid not null references public.products(id) on delete cascade,group_id uuid not null references public.modifier_groups(id) on delete cascade,primary key(product_id,group_id));
create table public.orders(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations(id),order_number bigint generated always as identity,public_token uuid not null unique default gen_random_uuid(),status text not null default 'pending' check(status in('pending','accepted','preparing','ready','completed','rejected','cancelled')),customer_name text,customer_phone text,notes text,total numeric(10,2) not null check(total>=0),payment_method text not null default 'pickup' check(payment_method='pickup'),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid not null references public.products(id),name_snapshot text not null,unit_price numeric(10,2) not null,quantity integer not null check(quantity>0 and quantity<=20),line_total numeric(10,2) not null);
create table public.order_item_modifiers(id uuid primary key default gen_random_uuid(),order_item_id uuid not null references public.order_items(id) on delete cascade,modifier_id uuid not null references public.modifiers(id),name_snapshot text not null,price_delta numeric(10,2) not null,unique(order_item_id,modifier_id));
create table public.order_status_history(id bigint generated always as identity primary key,order_id uuid not null references public.orders(id) on delete cascade,status text not null,created_at timestamptz not null default now());
create table public.order_notification_outbox(order_id uuid primary key references public.orders(id) on delete cascade,created_at timestamptz not null default now(),delivered_at timestamptz,attempts integer not null default 0,last_error text);

create index idx_categories_location on public.categories(location_id);
create index idx_products_location on public.products(location_id); create index idx_products_category on public.products(category_id);
create index idx_modifier_groups_location on public.modifier_groups(location_id); create index idx_modifiers_group on public.modifiers(group_id);
create index idx_pmg_group on public.product_modifier_groups(group_id); create index idx_orders_location on public.orders(location_id);
create index idx_order_items_order on public.order_items(order_id); create index idx_order_items_product on public.order_items(product_id);
create index idx_oim_order_item on public.order_item_modifiers(order_item_id); create index idx_oim_modifier on public.order_item_modifiers(modifier_id);
create index idx_status_history_order on public.order_status_history(order_id);

alter table public.locations enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security;
alter table public.modifier_groups enable row level security; alter table public.modifiers enable row level security; alter table public.product_modifier_groups enable row level security;
alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.order_item_modifiers enable row level security;
alter table public.order_status_history enable row level security; alter table public.order_notification_outbox enable row level security;

create policy "public active locations" on public.locations for select to anon,authenticated using(active);
create policy "public active categories" on public.categories for select to anon,authenticated using(active);
create policy "public available products" on public.products for select to anon,authenticated using(available);
create policy "public active modifier groups" on public.modifier_groups for select to anon,authenticated using(active);
create policy "public available modifiers" on public.modifiers for select to anon,authenticated using(available);
create policy "public product modifier links" on public.product_modifier_groups for select to anon,authenticated using(true);

create or replace function public.place_order(p_location_id uuid,p_items jsonb,p_customer_name text default null,p_customer_phone text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path='public' as $
declare v_order_id uuid;v_token uuid;v_order_number bigint;v_total numeric(10,2):=0;v_item jsonb;v_product products%rowtype;v_qty int;v_line numeric(10,2);v_order_item_id uuid;v_modifier_id uuid;v_modifier modifiers%rowtype;v_mod_total numeric(10,2);v_group record;v_count int;v_ids uuid[];
begin
 if not exists(select 1 from locations where id=p_location_id and active) then raise exception 'LOCATION_UNAVAILABLE'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then raise exception 'INVALID_ITEMS'; end if;
 if length(coalesce(p_customer_name,''))>120 or length(coalesce(p_customer_phone,''))>40 or length(coalesce(p_notes,''))>1000 then raise exception 'TEXT_TOO_LONG'; end if;
 insert into orders(location_id,status,total,customer_name,customer_phone,notes) values(p_location_id,'pending',0,nullif(trim(p_customer_name),''),nullif(trim(p_customer_phone),''),nullif(trim(p_notes),'')) returning id,public_token,order_number into v_order_id,v_token,v_order_number;
 for v_item in select * from jsonb_array_elements(p_items) loop
  select * into v_product from products where id=(v_item->>'product_id')::uuid and location_id=p_location_id and available for share;
  if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  v_qty:=coalesce((v_item->>'quantity')::int,1); if v_qty<1 or v_qty>20 then raise exception 'INVALID_QUANTITY'; end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_ids from jsonb_array_elements_text(coalesce(v_item->'modifier_ids','[]'::jsonb));
  if cardinality(v_ids)<>(select count(distinct x) from unnest(v_ids) x) then raise exception 'DUPLICATE_MODIFIER'; end if;
  v_mod_total:=0;
  for v_group in select g.* from modifier_groups g join product_modifier_groups pmg on pmg.group_id=g.id where pmg.product_id=v_product.id and g.active loop
   select count(*) into v_count from unnest(v_ids) x join modifiers m on m.id=x where m.group_id=v_group.id and m.available;
   if v_count<v_group.min_select or v_count>v_group.max_select then raise exception 'INVALID_MODIFIER_SELECTION'; end if;
  end loop;
  foreach v_modifier_id in array v_ids loop
   select m.* into v_modifier from modifiers m join product_modifier_groups pmg on pmg.group_id=m.group_id where m.id=v_modifier_id and pmg.product_id=v_product.id and m.available;
   if not found then raise exception 'INVALID_MODIFIER'; end if; v_mod_total:=v_mod_total+v_modifier.price_delta;
  end loop;
  v_line:=(v_product.price+v_mod_total)*v_qty;
  insert into order_items(order_id,product_id,name_snapshot,unit_price,quantity,line_total) values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_line) returning id into v_order_item_id;
  foreach v_modifier_id in array v_ids loop select * into v_modifier from modifiers where id=v_modifier_id; insert into order_item_modifiers(order_item_id,modifier_id,name_snapshot,price_delta) values(v_order_item_id,v_modifier.id,v_modifier.name,v_modifier.price_delta); end loop;
  v_total:=v_total+v_line;
 end loop;
 update orders set total=v_total,updated_at=now() where id=v_order_id; insert into order_status_history(order_id,status) values(v_order_id,'pending');
 return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'public_token',v_token,'status','pending','total',v_total);
end $;
revoke all on function public.place_order(uuid,jsonb,text,text,text) from public;
grant execute on function public.place_order(uuid,jsonb,text,text,text) to anon,authenticated;

create or replace function public.get_order_status(p_token uuid) returns jsonb language sql security definer set search_path='public' as $$select jsonb_build_object('order_number',o.order_number,'status',o.status,'total',o.total,'created_at',o.created_at,'updated_at',o.updated_at) from orders o where o.public_token=p_token$$;

create or replace function public.staff_set_order_status(p_order_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path='public' as $$declare v_current text;v_row public.orders%rowtype;begin if auth.role()<>'service_role' then raise exception 'FORBIDDEN';end if;select status into v_current from public.orders where id=p_order_id for update;if v_current is null then raise exception 'ORDER_NOT_FOUND';end if;if p_status<>v_current and not((v_current='pending' and p_status in('accepted','rejected','cancelled'))or(v_current='accepted' and p_status in('preparing','cancelled'))or(v_current='preparing' and p_status in('ready','cancelled'))or(v_current='ready' and p_status in('completed','cancelled')))then raise exception 'INVALID_STATUS_TRANSITION: % -> %',v_current,p_status;end if;if p_status<>v_current then update public.orders set status=p_status,updated_at=now() where id=p_order_id returning * into v_row;insert into public.order_status_history(order_id,status)values(p_order_id,p_status);else select * into v_row from public.orders where id=p_order_id;end if;return jsonb_build_object('id',v_row.id,'status',v_row.status,'updated_at',v_row.updated_at);end$$;

revoke all on function public.staff_set_order_status(uuid,text) from public,anon,authenticated;
grant execute on function public.staff_set_order_status(uuid,text) to service_role;
revoke all on function public.get_order_status(uuid) from public;
grant execute on function public.get_order_status(uuid) to anon,authenticated;
