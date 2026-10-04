# KDS B1 — single status-history writer

B1 is intentionally independent from the KDS canonical transition RPC.

## Change

Replace only the body of the existing
`staff_set_order_status(uuid,text)` function.

The existing `trg_order_status_history` trigger remains the sole writer to
`order_status_history`. The explicit history INSERT in the legacy RPC is
removed.

The function signature, service-role authorization, lifecycle transition map,
return JSON fields, and Telegram callback call shape remain compatible.

## Pre-cutover checks

- Confirm `trg_order_status_history` exists and is enabled.
- Confirm `log_order_status_change()` still writes one row when status changes.
- Confirm Telegram still calls `staff_set_order_status(order_id,status)`.
- Preserve the current production function definition for rollback.

## Acceptance

In an isolated environment run
`supabase/tests/kds_b1_legacy_telegram_compat.sql`.

Then, during an explicitly approved production maintenance window, use a
controlled test order and verify:

1. Telegram Accept updates the order.
2. Exactly one new `accepted` history row is written.
3. Preparing, Ready and Completed each add exactly one row.
4. Customer public-token status continues to follow the order.
5. Invalid reverse transitions remain rejected.

## Rollback

Restore the previously captured production definition of
`staff_set_order_status(uuid,text)`.

Rollback is function-only; it does not require dropping tables, columns,
triggers, or changing Telegram code.

Note: rollback restores the old duplicate-history defect. It is an emergency
compatibility rollback, not the desired steady state.

## Explicit non-goals

B1 does not add revision numbers, request IDs, actor metadata, staff sessions,
Realtime, KDS reads, or Telegram webhook hardening. Those are later gates.
