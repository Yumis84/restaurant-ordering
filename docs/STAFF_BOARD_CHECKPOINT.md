# Staff orders preview

## Current reconciliation — 2026-10-04 UTC

Author/Agent: ChatGPT (Codex).
Verified GitHub feature head before this increment:
`44a38631bf6a73646383aee0ed28603e21025024`.
Main remains `ea0075b5562d775607e983d2d28757b74c6582dd`.

The sections below describe earlier preview work, not the complete current
implementation. Subsequent work in another dialogue added:
- server-side staff sessions and PIN/code login;
- location/role-scoped staff administration and protected order APIs;
- live orders UI with polling/reconciliation and revision-aware transitions;
- draft additive/auth/transition migrations and isolated SQL acceptance files;
- KDS CI for web lint and server-mode Next.js build.

GitHub KDS CI passed for the reviewed head:
https://github.com/Yumis84/restaurant-ordering/actions/runs/37174893065
This proves that workflow's lint/build result, not HTTP/SQL/browser acceptance.
The checked-in security gate is still unchecked. This reconciliation did not
inspect the current deployed database or certify production readiness.

This increment fixes a confirmed UI error in `LiveOrders.tsx`: logout used
`.finally()` to navigate even if server-side revocation failed. Navigation now
follows a successful logout only; a separate persistent error message reports
failure and the button allows retry. Periodic order refresh does not clear that
logout message. Commit: `390f392e4389e92cec2c7a48b89f81a4168b8543`.

Next: complete the disposable HTTP acceptance in
`KDS_SECURITY_ACCEPTANCE_MATRIX.md`, including logout failure and retry.
Reconcile actual applied migration state before any production action.
Do not run all draft migrations blindly; the rollout documents distinguish
isolated combined drafts from compatibility-preserving staged cutover.
Keep customer ordering and existing Telegram operation working.
No production enablement, migration, merge, or deployment was performed in this
increment.

---


Author/Agent: CODEX
Date: 2026-10-03 UTC
Scope: RESTAURANT-ORDERING / KDS-V1 (Shavalleya pilot)

Owner deferred Otzovik integration and requested starting the staff interface in restaurant-ordering (formerly shavalleya-pages).

Route /orders/ is an isolated interactive preview. No Supabase imports, customer data, network requests, persistent writes or real staff credentials. Samples are explicitly fictional and loaded only by a button. Three columns map pending / accepted+preparing / ready; history contains completed/cancelled. Changed orders require acknowledgment, cancellation requires a reason, simulated offline disables mutations. Reload clears local state.

This is UI work only, not a production order receiver. Existing main route, customer menu, workflow, DNS and database remain unchanged. No architectural/ACL decision is implied.

Before live integration: verify/fix duplicate status history; implement canonical transition API with expected revision and idempotency; decide and implement secure staff authentication/device binding compatible with hosting; implement authorized active-order reads, realtime and reconciliation. Do not expose service role or read all orders anonymously. Do not implement an independent lifecycle.

Validation: source reviewed; runtime/build verification remains pending in an environment with dependencies. No claim of live acceptance. Modal keyboard focus trapping and real-device checks remain before production.

## Increment — item composition and preservation rule

Author/Agent: ChatGPT (Codex)
Date: 2026-10-03 UTC

The owner approved Restaurant Ordering as the main product and explicitly requires the existing Shavalleya ordering path to stay operational. See `RESTAURANT_ORDERING_ARCHITECTURE.md` for the agreed scope and rollout gates.

Replaced ambiguous string-array ticket contents with separate item snapshots. Each item renders its own additions, exclusions and note. Sample 101 now shows two identical product names with different compositions as two independent lines; sample 104 retains quantity two for identical composition. Order-level notes are labelled separately. Existing customer types/routes, functions, migrations and workflow are unchanged. Exclusions/item notes are preview extensions, not claims about deployed schema support.

Validation for this increment: strict TypeScript check of the two staff TSX files passed with React 19 types. Static React rendering checks passed for separate compositions, modifier/exclusion labels and escaping customer text. Full Next build, browser/device interaction and production acceptance have NOT been performed. Existing demo-only status/offline handling remains unchanged. No merge/deployment or database mutation.

Next: review the actual deployed order schema and transition functions read-only, establish isolated backend validation, and resolve protected staff hosting/auth before connecting live orders. Do not replace or remove the working customer/Telegram path to make the new interface easier to implement.

## Route boundary regression — 2026-10-04 UTC

Author/Agent: ChatGPT (Codex).
Continued from the reconciliation above; no newer Hub work reported.

- c4565ef: preserve the session cookie when database revocation fails, so retry
  targets the original session. Clear it only after successful revocation.
- 86a601e: cross-origin order transitions now map INVALID_ORIGIN to 403,
  rather than generic 500.
- 140ed6b: add scripts/kds-route-boundary.test.mjs.

Run from repository root with Node >=22.13:
`node --test scripts/kds-route-boundary.test.mjs`

Result: 4/4 PASS. Tests execute the actual TypeScript route bodies with injected
framework/database doubles. Both repaired cases fail against the pre-fix source.
Coverage: failed logout/retry; cross-origin rejection before auth/database;
missing session; server-derived location filter with no transition RPC call for
an inaccessible order. These tests do NOT verify the real database, Next HTTP
server, browser cookie behavior, RLS, valid login, or concurrent transitions.
No CI workflow change; run this test command manually until separately wired.

Local environment has Node/npm but no psql/docker executable, so disposable
PostgreSQL acceptance was not run here. Full security gate remains open.
Production database, customer flow, Telegram, main and deployment untouched.
