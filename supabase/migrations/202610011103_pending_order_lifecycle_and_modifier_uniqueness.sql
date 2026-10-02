-- Production migration 20261001110350
alter table public.orders alter column status set default 'pending';
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','accepted','preparing','ready','completed','rejected','cancelled'));
create unique index if not exists order_item_modifiers_unique_modifier on public.order_item_modifiers(order_item_id,modifier_id);
