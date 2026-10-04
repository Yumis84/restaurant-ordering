-- DRAFT: KDS V1 Phase A additive preparation.
-- NOT APPLIED. Review + isolated acceptance required before production use.
-- This migration intentionally does NOT replace triggers and does NOT switch Telegram.

begin;

alter table public.orders
  add column if not exists revision bigint not null default 0;

alter table public.order_status_history
  add column if not exists from_status text,
  add column if not exists revision bigint,
  add column if not exists request_id uuid,
  add column if not exists actor_type text,
  add column if not exists actor_id text,
  add column if not exists channel text,
  add column if not exists reason text;

create unique index if not exists uq_order_status_history_request
  on public.order_status_history(order_id, request_id)
  where request_id is not null;

-- Phase A deliberately leaves:
--   public.log_order_status_change()
--   trg_order_status_history
--   public.staff_set_order_status(uuid,text)
-- unchanged. Existing Telegram behavior therefore remains unchanged.
--
-- The canonical transition RPC is NOT installed by this production-safe draft,
-- because it depends on canonical audit/history semantics introduced at cutover.
--
-- Realtime publication is also deliberately NOT changed here. KDS realtime
-- enablement belongs with the protected staff read path and reconciliation tests.

commit;
