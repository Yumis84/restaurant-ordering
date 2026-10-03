# KDS V1 rollout plan

Status: design only. No production mutation authorized.

## Why rollout must be split

The live `staff_set_order_status()` currently performs an explicit
`order_status_history` insert after updating `orders`. The live BEFORE UPDATE
trigger also inserts history. That is the proven source of duplicate transition
rows.

The isolated-test draft replaces the trigger so it can capture richer audit
metadata. Applying that draft while Telegram remains on the legacy RPC would
still leave two writers. Therefore the combined draft must never be applied
directly to production.

## Phase A — additive preparation

Production-safe preparation may only add structures that do not change current
Telegram/customer behavior:

- nullable/defaulted audit columns;
- `orders.revision` with a compatibility-safe initial value;
- request-id uniqueness;
- new canonical RPC definition and ACL, but no live caller;
- protected KDS read/auth components once separately accepted.

Do not replace the live trigger in Phase A. Do not point Telegram at the new RPC.

## Phase B — atomic transition cutover

After isolated acceptance:

1. Put a controlled test/maintenance window around staff transition changes.
2. Deploy the canonical trigger/history writer.
3. Switch Telegram transition calls to the canonical transition contract.
4. Enable KDS mutations through the same backend contract.
5. Disable or redefine the legacy `staff_set_order_status()` so it cannot remain
   a second history writer.
6. Run one designated lifecycle test and verify one history row per transition,
   monotonic revision and correct customer status.
7. Roll back the complete cutover if any channel diverges.

The customer place-order/get-status path should not need a lifecycle rewrite.

## Historical duplicate rows

Do not silently delete historical duplicates during the cutover. Existing rows
are evidence of what happened in production. If cleanup is desired later, use a
separate reviewed data migration with an explicit deduplication rule and backup.

## Acceptance gate

No Phase B production work until:
- isolated SQL acceptance passes;
- staff authorization/location scoping passes;
- Telegram webhook/internal notification endpoint is hardened;
- KDS reconciliation behavior passes;
- owner explicitly approves production rollout.
