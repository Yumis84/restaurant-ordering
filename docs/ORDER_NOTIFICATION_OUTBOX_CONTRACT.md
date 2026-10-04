# Order notification outbox contract

Status: design only. Production behavior remains unchanged.

## Verified live baseline

`orders` has an AFTER INSERT trigger that inserts one row into
`order_notification_outbox`.

At audit time:
- existing outbox rows have `attempts = 0`;
- `delivered_at` is null;
- there is no pg_cron job available;
- no pg_net/cron worker was found;
- the only public-table triggers are notification enqueue and status history;
- `place-order` calls `telegram-orders?action=order&id=...` synchronously
  after the database order RPC succeeds.

Therefore the outbox is currently a record, not a delivery queue.

## Required invariant

Order acceptance by the customer API must depend only on durable order creation,
not on Telegram availability.

A Telegram outage must not lose the order. Notification delivery is retried
independently.

## Worker contract

A protected server/Edge worker claims pending outbox rows in bounded batches.

For each row:
1. claim using a concurrency-safe lease/lock;
2. load canonical order data server-side;
3. send the staff notification;
4. on success set `delivered_at`;
5. on failure increment `attempts`, record a bounded error and schedule retry;
6. after a retry ceiling mark/dead-letter for operator attention.

Multiple workers must not produce duplicate staff notifications for the same
outbox item. Delivery needs an idempotency key / persisted Telegram message id
or equivalent deduplication mechanism.

## Suggested additive fields

Conceptual only:
- `next_attempt_at timestamptz`;
- `locked_at timestamptz`;
- `lock_token uuid`;
- `telegram_message_id bigint`;
- `dead_lettered_at timestamptz`.

Do not add them to production until isolated tests exist.

## KDS relationship

KDS must read canonical orders independently of Telegram delivery. A failed
Telegram notification cannot make an order invisible to KDS.

The board may surface notification health separately, but order status and
notification status are different state machines.

## Cutover

Do not remove the current synchronous Telegram call until the durable worker has
passed:
- success delivery;
- transient failure + retry;
- worker crash after claim;
- duplicate worker race;
- Telegram duplicate/retry behavior;
- dead-letter/operator visibility.

During a controlled migration, dual delivery must be avoided or explicitly
deduplicated.
