-- Production migration 20261001112819
create table if not exists public.order_notification_outbox (
  order_id uuid primary key references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
alter table public.order_notification_outbox enable row level security;
