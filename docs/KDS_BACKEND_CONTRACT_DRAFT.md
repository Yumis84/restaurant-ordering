# KDS V1 backend contract — draft for isolated validation

Status: draft, not deployed.
Production reference: Supabase `bspktoshbiyhfpmulfek`.
Pilot: Shavalleya.

## Invariants

1. Customer ordering and token-based customer status remain compatible.
2. Exactly one history row is created for each actual status transition.
3. KDS and Telegram eventually use the same canonical transition RPC.
4. Every mutation carries an idempotency `request_id`.
5. Every mutation supplies `expected_status` and `expected_revision`; stale clients fail with a conflict instead of overwriting newer state.
6. Rejected/cancelled transitions require a reason.
7. Transition audit records actor type/id, channel, from/to status, revision and timestamp.
8. Browser clients never receive a Supabase service-role key.
9. Offline KDS is read-only; mutations remain disabled until reconciliation.
10. Realtime is a wake-up signal, not the sole source of truth. Reconnect/periodic reconciliation reads canonical order state.

## Current production defect covered by the draft

Production currently records each non-initial transition twice because both
`staff_set_order_status()` and the `trg_order_status_history` trigger insert
into `order_status_history`.

The draft keeps the trigger as the sole history writer and does not explicitly
insert history from the new RPC.

## Compatibility rollout

The draft intentionally leaves `staff_set_order_status()` in place. Nothing
switches Telegram automatically.

Isolated acceptance sequence:

1. Restore a production-shaped schema/data fixture in a non-production project.
2. Apply the draft migration there.
3. Verify old customer order placement/status lookup still works.
4. Verify pending -> accepted -> preparing -> ready -> completed produces one
   history row per transition and monotonic revisions.
5. Replay an identical `request_id`; state and history must not change.
6. Send two transitions with the same expected revision; exactly one may win.
7. Verify rejected/cancelled without a reason fails.
8. Verify anon/authenticated cannot execute the staff transition RPC.
9. Connect KDS read-only, then mutation path.
10. Switch a test Telegram flow to the same RPC only after KDS acceptance.
11. Production rollout requires an explicit owner decision and rollback plan.

## Still outside this draft

- Staff login/PIN hashing, rate limiting and device binding.
- Location-scoped staff authorization/read API.
- Telegram webhook/operational endpoint hardening.
- Order-change acknowledgement model.
- Payment-state model.
- Scheduled-order model.
- Item-level exclusions and item-level notes.

Those are separate increments so the existing Shavalleya path is not rewritten
all at once.
