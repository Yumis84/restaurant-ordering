# Staff orders preview

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
