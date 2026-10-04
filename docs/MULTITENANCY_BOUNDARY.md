# Restaurant Ordering — multitenancy boundary

Status: architecture decision. No production mutation.

## Verified current model

The live Shavalleya schema has `location_id` on:
- categories;
- products;
- modifier_groups;
- orders.

Child order/menu records inherit location through foreign-key chains.

There is currently no explicit restaurant/company/tenant identifier above
`locations`.

Therefore the deployed schema supports a location-scoped pilot and can evolve
toward multiple locations for one operator, but it is not yet accepted as a
multi-restaurant SaaS isolation model.

## Product model

Target hierarchy:

`tenant (restaurant/business) -> location -> menu/orders/staff`

A tenant may own one or more locations. Staff authorization is granted to a
tenant and one or more locations within that tenant.

Do not overload `location_id` to mean both business ownership and physical
location forever.

## KDS V1 boundary

For the Shavalleya pilot, KDS may operate against the existing single live
location, but every staff API must still be written as location-scoped.

Do not claim general multitenancy until tenant isolation has its own schema,
authorization and acceptance tests.

## Future additive model

Conceptually:
- `tenants(id, slug, name, active, ...)`;
- `locations.tenant_id NOT NULL`;
- staff membership/session references tenant plus allowed locations;
- protected APIs derive tenant/location scope server-side.

Migration must be additive first. Existing Shavalleya location receives the
initial tenant association without changing customer URLs/order behavior.

## Integrity concern

Several relationships are individually valid foreign keys but do not themselves
prove same-location ownership. For example a product references both
`location_id` and `category_id`; the FK alone does not guarantee the category
belongs to the same location.

The order-placement RPC currently performs application/database validation and
must continue preventing cross-location product/modifier composition.

Before general multi-tenant onboarding, add explicit acceptance tests for:
- product/category same location;
- product/modifier-group same location;
- order/product same location;
- staff tenant/location access;
- guessed UUID cross-tenant reads and mutations;
- notification routing to the correct tenant/location.

## Non-goal for current KDS increment

Do not introduce the full tenant migration merely to ship the Shavalleya KDS.
Design KDS interfaces with tenant/location boundaries now; migrate the data model
as a separate SaaS milestone.
