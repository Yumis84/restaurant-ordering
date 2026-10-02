# Future project idea — QR Ordering SaaS

Status: PARKED / FOR LATER
Recorded: 2026-10-01

## Context
Shavalleya remains the first live pilot. Do not let this future commercial layer delay or complicate the current pilot.

## Idea
Turn the reusable Shavalleya ordering template into a multi-tenant paid service for local restaurants/cafes.

Potential commercial flow:
1. Restaurant is onboarded and gets the complete service.
2. Initial free trial (working assumption: about 7 days; not a final product decision).
3. Before expiry, the owner receives Telegram reminders in the same operational channel used for orders.
4. After trial/paid period expires, new online ordering is suspended cleanly.
5. Owner receives a payment link/button for continued service.
6. Successful payment/webhook reactivates service automatically.

## Architectural direction for later
Model subscription/entitlement per tenant rather than hard-coding billing into a restaurant bot. Candidate fields include trial start/end, subscription status, paid-until, plan and payment-provider customer/subscription identifiers.

The entitlement check should happen before an order is accepted. A customer must never believe an order was accepted while the restaurant notification path is disabled.

## Scope decision
No billing/payment implementation now. First finish and validate the Shavalleya pilot. Return to this as a separate project/workstream after the first restaurant is operating successfully.

Longer-term questions: pricing, plans, payment provider, onboarding automation, multi-location tenants, self-service setup, analytics, support model, city-level sales/distribution, and possible expansion beyond the initial local market.
