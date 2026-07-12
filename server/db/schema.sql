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
