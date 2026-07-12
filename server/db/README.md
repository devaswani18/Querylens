# server/db — Database Setup

Run these two files in order against a fresh, empty database.

## Run Order

**Step 1 — Create tables:**
```bash
psql $DATABASE_URL -f schema.sql
```

**Step 2 — Seed data:**
```bash
psql $DATABASE_URL -f seed.sql
```

## What each file does

| File | Purpose |
|---|---|
| `schema.sql` | Creates all five tables: `users`, `products`, `orders`, `payments`, `reviews` |
| `seed.sql` | Inserts deterministic data via `setseed(0.42)` + `generate_series()` |

## Row counts after seeding

| Table | Rows |
|---|---|
| users | 5,000 |
| products | 1,000 |
| orders | 150,000 |
| payments | 150,000 (1:1 with orders) |
| reviews | 50,000 |

## Important: No index on `orders.customer_id`

The absence of an index on `orders.customer_id` is **intentional**. It is the core demo scenario — a sequential scan on 150k rows is what the Rule Engine is built to detect. The index is only added at runtime through the app's Apply Index feature.

## Database roles

Database roles (`querylens_readonly`, `querylens_index_manager`) are created in a separate step — do not add them here.
