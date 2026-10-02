# Shavalleya production schema snapshot

Verified against Supabase project `bspktoshbiyhfpmulfek` on 2026-10-01.

## Production migration ledger

1. 20261001100947 initial_shavalleya_secure_ordering
2. 20261001100959 security_and_indexes_hardening
3. 20261001101218 revoke_platform_helper_execution
4. 20261001101844 modifier_constraints_and_staff_status
5. 20261001110350 pending_order_lifecycle_and_modifier_uniqueness
6. 20261001110401 secure_pending_place_order
7. 20261001112101 enforce_order_status_transitions
8. 20261001112819 order_telegram_outbox

## Public data model

locations, categories, products, modifier_groups, modifiers, product_modifier_groups,
orders, order_items, order_item_modifiers, order_status_history, order_notification_outbox.

All tables have RLS enabled. Anonymous/authenticated SELECT policies exist only for the
active public menu graph: locations, categories, products, modifier_groups, modifiers,
product_modifier_groups. Order tables do not have public row policies.

## Ordering contract

`place_order(uuid,jsonb,text,text,text)` is SECURITY DEFINER. It validates the active
location and products, 1..50 line items, quantity 1..20, customer text limits, duplicate
modifier IDs, modifier membership/availability and group min/max constraints. Product
and modifier prices are read from the database. New orders are `pending`, snapshots are
stored, total is computed server-side, and a pending status-history row is created.

`get_order_status(uuid)` returns only order number, status, total and timestamps for the
high-entropy public token.

`staff_set_order_status(uuid,text)` requires `service_role`, locks the order, validates
the lifecycle, is idempotent for same-status calls, and writes status history only on a
real transition.

Lifecycle:
`pending -> accepted|rejected|cancelled -> preparing -> ready -> completed`
(with cancellation allowed from accepted/preparing/ready).

## Telegram delivery

`order_notification_outbox` is the durable notification handoff table. Telegram delivery
must be server-side. Browser clients must never receive the service-role key or bot token.

## Drift warning

The first four historical GitHub migration files were created as documentation stubs and
are not sufficient by themselves to recreate production. Do not treat this repository as
fully replayable until the historical baseline has been replaced by an exact schema dump
or verified fresh-project replay.
