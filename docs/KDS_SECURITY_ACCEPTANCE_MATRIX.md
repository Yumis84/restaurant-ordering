# KDS staff security acceptance matrix

Status: feature-branch contract. Production unchanged.

## Session boundary

- No cookie -> staff reads/mutations return 401.
- Expired or revoked session -> 401.
- Inactive staff user -> 401.
- Session token is stored only as SHA-256 hash server-side.
- Cookie is HttpOnly, Secure, SameSite=Strict.
- Staff mutations require a same-origin Origin header.
- Logout revokes the server session; revocation failure is surfaced.
- Disabling a location membership currently revokes all sessions for that staff
  user (safe pilot behavior; refine to location-scoped sessions before mature
  multi-location SaaS if simultaneous access to other locations is required).

## Location isolation

- Active-order reads are restricted to server-derived active memberships.
- Transition API verifies order.location_id is in the authenticated membership set.
- Client-supplied location ids never authorize order mutations.
- Staff management requires manager/owner membership for the target location.
- Cross-location staff listing, creation, access changes and order transitions
  must return 403/404 without revealing protected data.

## Role hierarchy

- staff: process orders only.
- manager: manage ordinary staff in their location.
- manager cannot create another manager.
- manager cannot disable/enable a manager.
- owner can create and manage managers.
- owner cannot be disabled through the normal staff-access endpoint.
- self access-disable is blocked.

## Credential behavior

- Unknown staff code and wrong PIN are indistinguishable to the client.
- PIN hashes are never returned.
- Five wrong PIN attempts persist and lock the account for 15 minutes.
- Successful authentication after lock expiry resets failure state.
- Staff code lookup is normalized case-insensitively.
- Login service errors are distinct from invalid credentials operationally.

## Order mutation integrity

- service_role never enters the browser.
- KDS uses expected_status + expected_revision.
- stale state -> 409 ORDER_CONFLICT.
- 409 causes canonical reconciliation, never blind mutation retry.
- one user action has one request_id.
- replaying that request_id is idempotent.
- trigger is the sole history writer after B1/B2.
- cancellation/rejection requires a reason.

## Required isolated HTTP acceptance before enablement

1. unauthenticated GET active orders -> 401.
2. cross-origin login/mutation -> 403.
3. valid login -> Secure HttpOnly session cookie.
4. staff A cannot read/transition location B.
5. ordinary staff cannot access staff administration.
6. manager cannot create or alter manager.
7. owner can create manager.
8. disabled membership immediately loses authorization.
9. logout invalidates the same session server-side.
10. stale order revision -> 409 and refreshed canonical state.
11. duplicate request_id -> same original transition, no extra history.
12. offline/reconciliation failure -> UI mutations disabled.

No production enablement until these pass in a disposable environment.
