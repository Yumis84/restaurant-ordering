# KDS V1 staff read/auth contract

Status: design only. No production mutation.

## Verified production baseline

For `orders`, `order_items`, `order_item_modifiers` and
`order_status_history`:

- RLS is enabled;
- there are no row policies granting browser users order access;
- `anon` and `authenticated` do not have SELECT;
- order reads used by staff automation are service-side.

Preserve this boundary. Do not solve KDS by granting broad SELECT to browser roles.

## Architecture

KDS browser -> protected staff backend -> service-role database access.

The browser never receives:
- Supabase service-role key;
- Telegram bot token;
- unrestricted order table credentials.

The backend authenticates a staff session and derives authorized
`location_id` server-side. A browser-supplied location is never sufficient
authorization.

## Minimum staff session

A session record should bind:
- opaque session id / HttpOnly Secure cookie;
- staff identity;
- allowed location(s);
- device binding identifier;
- issued/last-seen/expiry timestamps;
- revoked timestamp;
- auth method/version.

PINs, if used for V1, are stored only as slow password hashes. Apply attempt
rate limiting and temporary lockout. Never store plaintext PINs.

## Active-order read

The protected endpoint returns only orders for the session's authorized
location(s), normally statuses:
`pending, accepted, preparing, ready`.

Each order includes at minimum:
- id/order_number;
- status + revision;
- created_at/updated_at;
- customer fulfillment details needed by staff;
- order-level notes;
- item snapshots and modifier snapshots.

Do not expose `public_token` to the staff UI unless there is a demonstrated
operational need.

## Cross-location isolation acceptance

With staff A authorized only for location A and staff B only for location B:

1. A sees A orders.
2. A cannot fetch a B order by guessed UUID.
3. A cannot transition a B order.
4. Realtime/reconciliation does not reveal B metadata to A.
5. Revoking A's session blocks the next read and mutation.
6. Service-role credentials remain server-only in all cases.

## Hosting consequence

The customer storefront may remain static/GitHub Pages. The protected staff
backend does not need to share that hosting model. KDS can live under the same
product/repository while its authenticated server boundary is deployed
separately.
