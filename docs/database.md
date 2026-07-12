# QueryLens AI — Database (V1)

Refer to `docs/requirements.md` for scope and `docs/architecture.md` for how this is queried. This document defines schema, relationships, indexing strategy, and the seed data plan.

## Domain: E-Commerce

Chosen because it produces natural, demo-friendly slow queries (filtering large order tables by customer, joining orders to payments/reviews) without needing invented business logic.

## Schema

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    price_cents   INTEGER NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Intentionally NO index on customer_id at seed time.
-- This is the core demo table: a seq scan here is the entire point of the project.
CREATE TABLE orders (
    id            SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES users(id),
    product_id    INTEGER NOT NULL REFERENCES products(id),
    quantity      INTEGER NOT NULL,
    total_cents   INTEGER NOT NULL,
    status        TEXT NOT NULL,       -- 'pending' | 'completed' | 'cancelled'
    ordered_at    TIMESTAMP NOT NULL
);

CREATE TABLE payments (
    id            SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(id),
    amount_cents  INTEGER NOT NULL,
    method        TEXT NOT NULL,       -- 'card' | 'upi' | 'paypal'
    paid_at       TIMESTAMP NOT NULL
);

CREATE TABLE reviews (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(id),
    user_id       INTEGER NOT NULL REFERENCES users(id),
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

## Relationships
- `users` 1 → many `orders` (via `customer_id`)
- `products` 1 → many `orders` (via `product_id`)
- `orders` 1 → 1 `payments` (via `order_id`)
- `products` 1 → many `reviews`, `users` 1 → many `reviews`

## Row Count Targets

| Table | Rows | Reasoning |
|---|---|---|
| users | 5,000 | enough distinct customer_ids for a realistic scan |
| products | 1,000 | small dimension table |
| orders | 150,000 | the core demo table — big enough for a seq scan to be measurably slow (100ms+) |
| payments | 150,000 | 1:1 with orders |
| reviews | 50,000 | moderate size, secondary demo table if needed later |

## The Core Demo Query
```sql
SELECT * FROM orders WHERE customer_id = 42;
```
With no index on `customer_id` and 150k rows, this forces a sequential scan — the exact scenario the Rule Engine is built to catch. After the user applies the suggested index (`CREATE INDEX idx_orders_customer ON orders(customer_id);`), the same query becomes an index scan, and the before/after timing comparison should show a dramatic, honest improvement.

## Seed Strategy
Entirely inside PostgreSQL using `generate_series()` and built-in `random()`/date functions — no external scripts or libraries needed for V1. Deterministic via `setseed()` so re-running the script always produces the same data (important for consistent demo behavior and for you to reproducibly explain query costs in an interview).

```sql
-- seed.sql (run against a fresh database)

SELECT setseed(0.42);  -- fixes the random sequence — rerunning this script gives identical data every time

-- Users
INSERT INTO users (full_name, email, created_at)
SELECT
    'User ' || i,
    'user' || i || '@example.com',
    now() - (random() * interval '365 days')
FROM generate_series(1, 5000) AS i;

-- Products
INSERT INTO products (name, category, price_cents, created_at)
SELECT
    'Product ' || i,
    (ARRAY['Electronics','Home','Books','Clothing','Toys'])[floor(random()*5 + 1)],
    (random() * 9000 + 500)::int,
    now() - (random() * interval '365 days')
FROM generate_series(1, 1000) AS i;

-- Orders (the core demo table — 150k rows, no index on customer_id)
INSERT INTO orders (customer_id, product_id, quantity, total_cents, status, ordered_at)
SELECT
    (floor(random() * 5000) + 1)::int,
    (floor(random() * 1000) + 1)::int,
    (floor(random() * 5) + 1)::int,
    (random() * 20000 + 500)::int,
    (ARRAY['pending','completed','cancelled'])[floor(random()*3 + 1)],
    now() - (random() * interval '365 days')
FROM generate_series(1, 150000) AS i;

-- Payments (1:1 with orders)
INSERT INTO payments (order_id, amount_cents, method, paid_at)
SELECT
    o.id,
    o.total_cents,
    (ARRAY['card','upi','paypal'])[floor(random()*3 + 1)],
    o.ordered_at + interval '1 hour'
FROM orders o;

-- Reviews
INSERT INTO reviews (product_id, user_id, rating, created_at)
SELECT
    (floor(random() * 1000) + 1)::int,
    (floor(random() * 5000) + 1)::int,
    (floor(random() * 5) + 1)::int,
    now() - (random() * interval '365 days')
FROM generate_series(1, 50000) AS i;
```

**Do not add any index on `orders.customer_id` in this script.** That absence is intentional and is the entire premise of the core feature. Indexes only get added at runtime, by the user, through the app.

## Migration Approach
For V1, a single `schema.sql` (table definitions) + `seed.sql` (data) run manually against a fresh database — no formal migration tool (Knex/Prisma migrations) needed at this scope. Document exact run order in `database.md`'s companion `README` inside `server/db/`:
1. `psql $DATABASE_URL -f schema.sql`
2. `psql $DATABASE_URL -f seed.sql`

## Roles (referenced from `architecture.md`)
```sql
-- Read-only role: used by /query/execute and /explain
CREATE ROLE querylens_readonly LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE querylens TO querylens_readonly;
GRANT USAGE ON SCHEMA public TO querylens_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO querylens_readonly;

-- Index manager role: used only by /apply-index, nothing else
CREATE ROLE querylens_index_manager LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE querylens TO querylens_index_manager;
GRANT USAGE ON SCHEMA public TO querylens_index_manager;
GRANT CREATE ON SCHEMA public TO querylens_index_manager;
-- No SELECT, INSERT, UPDATE, DELETE, DROP granted to this role.
```
