# Restaurant Ordering — agreed direction

Author/Agent: ChatGPT (Codex)
Date: 2026-10-03 UTC
Scope: RESTAURANT-ORDERING / KDS-V1
Hub decision: 96fee8c1-8056-4493-bf68-b69b1d4eff66

## Product and ownership

Restaurant Ordering is the shared ordering platform for restaurants, cafes and shawarma shops. Shavalleya is the first pilot and regression reference. `Yumis84/restaurant-ordering` contains both customer and staff interfaces; separate staff hosting/origin does not require another repository.

Evolve existing Supabase project `bspktoshbiyhfpmulfek`. Menu, item snapshots, orders and their lifecycle belong to Ordering. Multi-company/location access isolation is a target, not an implemented or tested capability. Otzovik company/profile/review data remains separate; integration is deferred. Do not introduce an independent company registry without reconciling future Otzovik identity ownership.

## Preserve the working pilot

The owner explicitly requires the existing Shavalleya customer ordering, Telegram reception/status flow and customer status tracking to remain operational throughout development. Rebuilding later is not an acceptable substitute for preserving the working path.

- Develop and review on a feature branch; do not merge or publish an unverified staff interface.
- Keep customer routes, deployed functions, database policies, DNS, secrets and deployment workflow unchanged for UI-only work.
- Prepare backend changes as backward-compatible additions and test them on an isolated database before production rollout. Existing migrations/baseline must not be replayed against production.
- Before a backend rollout, verify customer menu → checkout → saved order/composition → Telegram reception → status lifecycle → customer status, including one history record per transition. Use a designated test environment/order, not unannounced live staff notifications.
- Switch staff web and Telegram onto one canonical transition path only after concurrency, idempotency, authorization and rollback have been validated. Keep the working Telegram path until its replacement passes acceptance.
- Do not lower the agreed staff authentication protections just to fit static hosting. The server/HttpOnly deployment design is still an explicit prerequisite for live staff access.

## Current UI increment

`app/orders/page.tsx` remains an explicit, in-memory demonstration. `TicketItems.tsx` renders each line by its own ID with its saved name, quantity and modifier names. Different compositions remain separate lines. Per-item exclusions and notes are preview extensions: the checked-in baseline has order-level notes, but no such order-item columns. No migration, live reader or anonymous access is implied.

Keep order-level comments separate from item-level comments. Do not infer structured exclusions from free text or look up current catalogue names/prices when displaying historical orders.

## Next integration gate

Inspect actual deployed schema and Telegram transition behavior read-only, reconcile with the versioned baseline, and resolve the staff hosting/authentication contract. Then prepare additive protected staff reads and shared transition changes for isolated acceptance. A demo button must never mutate production data.
