# KDS V1 realtime + reconciliation contract

Status: design only.

## Live baseline

At audit time, neither `public.orders` nor `public.order_status_history` is in
the `supabase_realtime` publication.

KDS must therefore not assume current production provides order-change events.

## Contract

Realtime is only a change signal. Canonical state comes from an authorized,
location-scoped active-order read endpoint.

The staff client must reconcile:
- on initial load;
- after reconnect;
- after a realtime signal;
- after every successful mutation;
- periodically while online.

If the client is offline or reconciliation fails, mutations are disabled.

## Subscription scope

Do not expose all restaurant orders to an anonymous browser subscription.

Before enabling realtime:
1. staff authentication exists;
2. location authorization is enforced;
3. the browser cannot access service-role credentials;
4. active-order reads are scoped to authorized locations;
5. cross-location isolation has an acceptance test.

If direct Supabase Realtime cannot satisfy those constraints cleanly, use a
protected server/Edge Function stream or notification channel instead.

## Revision handling

Each canonical order response includes `revision`.

The UI may render cached state optimistically for responsiveness, but a status
mutation carries the last observed `expected_status` and `expected_revision`.
A conflict triggers immediate reconciliation instead of retrying the mutation
blindly.

## History

The operational board should not depend on history events to reconstruct current
state. Current state comes from `orders`; history is immutable audit evidence.
