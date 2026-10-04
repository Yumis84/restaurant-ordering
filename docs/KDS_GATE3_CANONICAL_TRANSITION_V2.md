# Gate 3 — canonical order transition V2

Status: contract review only. No production mutation.

## Goal
All Web, Telegram and future channel actions converge on one canonical order transition contract.

## Authorization boundary
The caller-facing backend authenticates a canonical account/session and resolves:
company membership -> location scope -> order capability.

Provider identity or destination is never sufficient authorization.

## Transition command
Server constructs the command after authorization:

- order_id
- to_status
- expected_status
- expected_revision
- request_id
- actor_membership_id
- channel: web | telegram | max | vk | admin | system
- destination_id (optional internal destination reference)
- reason (bounded, required for reject/cancel)

Do not trust actor_membership_id, company_id, location_id or elevated role values directly from an untrusted client.

## Atomic acceptance / claim
For pending -> accepted:
1. lock the order row;
2. verify expected status/revision;
3. verify actor membership has order-handling capability for the order location;
4. write accepted_by_membership_id and accepted_at together with status=accepted;
5. increment revision once;
6. write exactly one audit/history event;
7. return canonical state.

A concurrent later accept must not overwrite accepted_by. It returns conflict/current canonical state.

## Idempotency
(order_id, request_id) is unique for mutation history.
Replay of the same request returns the already-produced canonical result and does not create another transition or claim.

## Attribution
History records the canonical actor membership/account. Channel is separate metadata.

Example:
actor = membership 123
action = pending -> accepted
channel = telegram
destination = employee personal Telegram
request_id = ...
revision = 4

Telegram is never the actor.

## Responsibility
accepted_by is immutable attribution of the acceptance event.

Future assigned_to may change through an explicit reassignment action. Reassignment does not rewrite accepted_by or previous audit events.

## Provider-neutral notifications
After commit, notification delivery is downstream:
canonical transition -> outbox/event -> configured destinations.

Delivery failure must not roll back a successfully committed order transition. Retries must be idempotent.

## Required acceptance tests
1. pending -> accepted records actor and channel once.
2. two different actors concurrently accept: only one wins.
3. same request_id replay returns same result without extra history.
4. stale expected_revision cannot mutate.
5. illegal lifecycle cannot mutate.
6. actor outside order location cannot read/claim order.
7. channel/destination cannot grant authorization.
8. Telegram delivery failure cannot revert canonical transition.
9. reject/cancel without required reason fails.
10. service-role credentials never reach browser/static assets.

## Shared-account dependency
The final foreign key for actor_membership_id should target the shared company-membership model used by Отзыв.com. Until that model is finalized, do not create a competing restaurant-specific identity silo in production.
