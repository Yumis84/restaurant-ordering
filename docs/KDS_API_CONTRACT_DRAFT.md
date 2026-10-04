# KDS V1 protected API contract

Status: draft interface, not implemented/deployed.

All endpoints require a valid staff session. Authorization is resolved
server-side from that session.

## GET /staff/api/orders/active

Returns the canonical active-order snapshot for authorized locations.

Response concept:
```json
{
  "server_time": "ISO-8601",
  "orders": [
    {
      "id": "uuid",
      "order_number": 123,
      "location_id": "uuid",
      "status": "pending",
      "revision": 0,
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601",
      "customer": { "name": "...", "phone": "..." },
      "notes": "...",
      "items": []
    }
  ]
}
```

The server ignores/denies unauthorized location selection.

## POST /staff/api/orders/:id/transition

Request concept:
```json
{
  "to_status": "accepted",
  "expected_status": "pending",
  "expected_revision": 0,
  "request_id": "uuid",
  "reason": null
}
```

The backend supplies actor identity, authorized location and channel=`kds`
to the canonical database transition function.

Success returns canonical order status/revision.

Conflict returns HTTP 409 plus enough current state to force reconciliation;
the client must not blindly retry with a new expected revision.

Unauthorized cross-location access returns 404/403 without leaking order
details.

## POST /staff/api/session

Authenticates staff using the approved V1 mechanism and creates a server-side
session. The response sets an HttpOnly + Secure + SameSite cookie. Do not put
long-lived staff credentials in localStorage.

## DELETE /staff/api/session

Revokes the current session and clears the cookie.

## Health/reconciliation behavior

A successful mutation is followed by canonical reconciliation. If the staff
backend/database is unavailable, the board may display cached data but all
mutation controls are disabled.
