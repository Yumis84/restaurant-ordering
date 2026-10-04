# Telegram orders hardening + KDS cutover

Status: design only. Live Edge Function v7 remains unchanged.

## Verified live risks

The current `telegram-orders` function has `verify_jwt=false` and:
- accepts webhook POSTs without validating Telegram's webhook secret header;
- exposes GET `register_webhook` without application authentication;
- exposes GET `webhook_info` without application authentication;
- exposes GET `demo_card` without application authentication;
- exposes GET `order?id=...` without application authentication;
- uses service-role database access internally;
- calls the legacy `staff_set_order_status()` RPC.

The staff-chat ID check limits callback processing, but it is not webhook
authenticity verification.

## Required target

### Public webhook route

Only the Telegram webhook receiver is public.

Validate `X-Telegram-Bot-Api-Secret-Token` against a server secret before
parsing/processing an update. Reject mismatches without performing Telegram or
database actions.

When registering the webhook, set the same `secret_token` with Telegram.

### Operational/admin actions

Do not keep webhook registration, webhook inspection or demo sends as anonymous
GET query parameters on the public webhook.

Move them to one of:
- authenticated deployment/admin tooling; or
- a separate admin-only Edge Function protected by an independent secret/session.

### Internal order notification

The current `GET ?action=order&id=...` route is not an acceptable internal API.
Replace it with an authenticated internal call or a real outbox worker.

The caller must prove internal authorization before the function reads customer
PII or sends a staff message.

Prefer POST for commands. Do not put order identifiers for operational commands
into unauthenticated GET endpoints.

## Transition cutover

Do not switch Telegram independently of the canonical history cutover.

At Phase B:
1. canonical transition function is accepted;
2. Telegram callback supplies request id, expected status/revision and
   channel=`telegram`;
3. legacy `staff_set_order_status()` is removed/redefined as a second writer;
4. KDS and Telegram share the same state machine;
5. Telegram handles conflict by re-reading canonical state rather than forcing
   the requested transition.

## Callback idempotency

Derive/store a stable request id from the Telegram callback/update identity so
Telegram retries cannot create a second transition.

Do not trust callback data for authorization or current state. It identifies the
requested order/action only; database state + server authorization decide whether
the transition is valid.

## Rollout order

1. Build hardened function in source control.
2. Test with a separate bot/chat or isolated environment.
3. Verify webhook secret rejection/acceptance.
4. Verify internal notification auth.
5. Verify Telegram lifecycle against canonical transition tests.
6. Only then schedule production cutover with rollback.
