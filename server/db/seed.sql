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
FROM generate_series(1, 1000000) AS i;

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
