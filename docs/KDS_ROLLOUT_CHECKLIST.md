# KDS rollout checklist

Status: review only. No production mutation is authorized by this document.

## Current acceptance
- Static mobile /orders demo: PASS.
- Live KDS: disabled.
- Existing storefront and Telegram flow: preserve.

## Ordered gates

1. Single history writer
   - Keep the existing order-status trigger as the only history writer.
   - Remove the duplicate history insert from the legacy staff status RPC.
   - Verify one legal transition produces exactly one history row.
   - Verify Telegram lifecycle still works.

2. Staff identity and sessions
   - Server-side staff users, location memberships, and sessions.
   - PIN stored as a slow hash; no plaintext PIN.
   - Lock after five failed attempts for 15 minutes.
   - Opaque session token; database stores only its hash.
   - Revoked or expired sessions fail immediately.
   - Location authorization is derived server-side.

3. Canonical KDS transition
   - Require expected status and expected revision.
   - Require an idempotency/request identifier.
   - Reject stale and illegal transitions.
   - Increment revision once and write history once.
   - Do not reveal orders from another location.

4. Protected active-order read
   - Only pending, accepted, preparing, ready.
   - Only locations authorized for the staff session.
   - No service-role key or unrestricted order credentials in browser assets.

5. Shadow pilot
   - Keep Telegram operational.
   - KDS starts read/shadow first.
   - Reconcile initial load, reconnect, after mutation, signal refresh, periodic refresh.
   - Realtime is a signal, not canonical state.

6. Live pilot
   - Enable mutations only after prior gates pass.
   - Start with an explicitly selected test location/account.
   - Keep Telegram as fallback until a separate retirement decision.

## Stop conditions
Stop on duplicate history, Telegram regression, customer-order regression, cross-location visibility, client exposure of service-role credentials, broken session revocation, or stale mutations overwriting newer state.

## Approval boundary
Code, tests, branches, and read-only audits may be prepared now. Applying production migrations/functions, creating production staff credentials, enabling live KDS, or changing production routing requires explicit owner approval.
