# Order actor and channel model

Status: architecture review. No production mutation.

## Principle
Web is the canonical operational interface. Telegram and future providers are optional delivery/action adapters. Provider linkage never grants company permission.

## Identity and access
Canonical authorization chain:
account -> company membership -> location scope -> capabilities.

Named jobs (owner, manager, order operator, cook, waiter, marketer) are presets over granular capabilities, not mutually exclusive identities.

A member may link external identities such as Telegram. External identity maps back to the canonical account/member.

## Order actions
Every canonical order mutation should be attributable to:
- actor account/member;
- company/location scope;
- action/status transition;
- timestamp;
- channel/provider;
- request id;
- order revision;
- optional reason.

Do not encode Telegram as an actor type. Telegram is a channel. The actor remains the authorized member/account.

## Claim versus responsibility
For an unclaimed pending order, the first successful authorized acceptance wins atomically. Record accepted_by membership and accepted_at.

Keep responsibility separate from audit actor so a manager can later reassign responsibility without rewriting who originally accepted the order.

A later phase may add assigned_to membership and reassignment events.

## Destinations
Notification destinations are independent from authorization:
- company/shared destination (for example a Telegram group);
- personal destination linked by an authorized member;
- future adapters such as MAX or VK where supported.

One order may be delivered to multiple destinations. All actions converge on the same canonical order state.

## Concurrency
Mutations require expected status, expected revision and request id. A repeated request is idempotent. A stale competing acceptance receives canonical already-claimed/conflict state and must not create a second claim/history event.

## Proposed additive fields
Before production use, review an additive schema for:
- orders.accepted_by_membership_id
- orders.accepted_at
- optional orders.assigned_to_membership_id
- audit/history actor membership/account identifiers
- channel and provider/destination metadata

Exact foreign keys depend on the future shared отзыв.com company-membership model. Do not create restaurant-local duplicate account tables that would later conflict with that model.
