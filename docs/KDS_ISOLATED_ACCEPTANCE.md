# KDS V1 isolated acceptance sequence

Do not run draft migrations against the live Shavalleya database merely to test
them.

## Disposable environment order

1. Restore/apply the production baseline schema.
2. Apply Phase A additive draft.
3. Apply staff auth/session draft.
4. Apply PIN auth draft.
5. Run `supabase/tests/kds_staff_auth.sql`.
6. Run `supabase/tests/kds_staff_sessions.sql`.
7. Apply the canonical transition cutover draft in the disposable environment.
8. Run `supabase/tests/kds_transition_contract.sql`.
9. Build the Next.js application with server-only environment variables supplied
   only to the server runtime.
10. Exercise HTTP acceptance:
    - invalid login -> 401;
    - valid login -> HttpOnly Secure cookie;
    - active orders -> only authorized location;
    - revoked/expired session -> denied;
    - cross-location guessed order -> denied;
    - offline UI -> mutation controls disabled;
    - stale revision -> 409 + reconciliation;
    - idempotent transition replay -> same original result.

## Deployment dependency

The staff API code depends on staff schema/RPCs. Do not deploy/route staff login
to production before its reviewed database migration exists.

Likewise, do not expose the KDS UI as operational until the protected staff
backend passes the HTTP acceptance suite.

## Live regression gate

Before any production cutover, separately verify the existing customer flow:
menu load -> place order -> public token status -> Telegram notification/status
buttons. No KDS rollout is allowed to trade away the working pilot flow.
