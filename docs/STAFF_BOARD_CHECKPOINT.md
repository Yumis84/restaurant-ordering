# Staff orders preview

Author/Agent: CODEX
Date: 2026-10-03 UTC
Scope: SHAVALLEYA / STAFF-ORDER-BOARD

Owner deferred Otzovik integration and requested starting the staff interface in restaurant-ordering (formerly shavalleya-pages).

Route /orders/ is an isolated interactive preview. No Supabase imports, customer data, network requests, persistent writes or real staff credentials. Samples are explicitly fictional and loaded only by a button. Three columns map pending / accepted+preparing / ready; history contains completed/cancelled. Changed orders require acknowledgment, cancellation requires a reason, simulated offline disables mutations. Reload clears local state.

This is UI work only, not a production order receiver. Existing main route, customer menu, workflow, DNS and database remain unchanged. No architectural/ACL decision is implied.

Before live integration: verify/fix duplicate status history; implement canonical transition API with expected revision and idempotency; decide and implement secure staff authentication/device binding compatible with hosting; implement authorized active-order reads, realtime and reconciliation. Do not expose service role or read all orders anonymously. Do not implement an independent lifecycle.

Validation: source reviewed; runtime/build verification remains pending in an environment with dependencies. No claim of live acceptance. Modal keyboard focus trapping and real-device checks remain before production.
