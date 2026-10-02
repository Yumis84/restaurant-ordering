# Reusable restaurant ordering template

Shavalleya is the first tenant/pilot and the reference implementation.

## Reusable core
- Guest QR menu and cart
- Server-authoritative order creation
- Token-scoped customer status polling
- Order lifecycle and history
- Telegram staff workflow
- RLS/security boundary
- Edge Function notification layer

## Deployment-specific configuration
- Restaurant/tenant identity and branding
- Locations and QR destinations
- Menu/categories/products/modifiers
- Telegram bot token, destination chat and authorized staff
- Public Supabase URL/publishable key
- Future billing entitlement

## Acceptance definition for a new restaurant
A fresh deployment is successful only when a real browser order creates the canonical DB order, produces the staff notification, staff can complete the lifecycle, and the customer status view reflects every transition.

## Current pilot caveat
The deployed Telegram function still contains pilot-specific CHAT_ID/SELF_URL constants and unauthenticated administrative/order GET actions. These must be converted to deployment configuration/internal authenticated delivery before this template is production-ready for reuse.
