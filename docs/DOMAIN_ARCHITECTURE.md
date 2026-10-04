# Domain architecture

## Canonical split

| Domain | Repository | Purpose | Safety boundary |
| --- | --- | --- | --- |
| `shavalleya.ru` | `Yumis84/shavalleya` | Customer storefront for the Shavalleya location | Production customer ordering. Do not use for SaaS/KDS experiments. |
| `shavalleya.online` | `Yumis84/restaurant-ordering` | Restaurant service / SaaS: staff UI, KDS, cabinet, menu/settings, future restaurants | Service contour. New staff features are developed here. |

## Proven state

- `Yumis84/shavalleya` contains a root `CNAME` file with `shavalleya.ru`.
- Both repositories have independent GitHub Pages workflows.
- The `restaurant-ordering` repository metadata uses `shavalleya.online` as its homepage.

## Rules

1. Never deploy KDS/service experiments to `shavalleya.ru`.
2. Never change DNS/custom-domain settings as part of a code-only rollout.
3. The safe staff demo is `/orders` on the service contour.
4. Live KDS remains disabled until database/auth/transition acceptance is complete.
5. Customer ordering and staff service may share Supabase data, but have separate deployment surfaces.
