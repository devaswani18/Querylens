# QueryLens AI — Architecture (V1)

Refer to `docs/requirements.md` for scope. This document defines structure and data flow only — it does not introduce new features.

## High-Level Flow

```
React (SQL Editor / Schema Explorer / Plan Viewer)
        │  Axios (JSON over HTTPS)
        ▼
Node.js + Express API
   ├─ Validates & executes queries directly against PostgreSQL
   ├─ Runs EXPLAIN (ANALYZE, FORMAT JSON) directly against PostgreSQL
   ├─ Runs the Rule Engine (plain code) on the EXPLAIN JSON
   ├─ Calls Gemini API directly (no separate AI service) to:
   │     - translate NL → SQL
   │     - turn Rule Engine findings into plain-English explanations
   └─ Runs the restricted "apply index" endpoint (separate from general query execution)
        │
        ▼
PostgreSQL (local in dev, Neon in prod — switched via DATABASE_URL env var)
```

Single backend. No Python/FastAPI service (removed per earlier decision — unnecessary for two prompt-in/text-out LLM calls).

## Backend Folder Structure (Feature-Based)

```
server/
├── src/
│   ├── config/
│   │   ├── db.ts              # Postgres pool setup, reads DATABASE_URL
│   │   ├── env.ts             # Loads & validates all env vars at startup
│   │   └── gemini.ts          # Gemini API client setup
│   │
│   ├── features/
│   │   ├── query/
│   │   │   ├── query.routes.ts        # POST /api/query/execute
│   │   │   ├── query.controller.ts
│   │   │   ├── query.service.ts       # validation + execution logic
│   │   │   └── query.validator.ts     # allowlist SELECT/WITH/EXPLAIN, reject rest
│   │   │
│   │   ├── schema/
│   │   │   ├── schema.routes.ts       # GET /api/schema/tables, GET /api/schema/tables/:name
│   │   │   ├── schema.controller.ts
│   │   │   └── schema.service.ts      # queries information_schema
│   │   │
│   │   ├── explain/
│   │   │   ├── explain.routes.ts      # POST /api/explain
│   │   │   ├── explain.controller.ts
│   │   │   ├── explain.service.ts     # runs EXPLAIN (ANALYZE, FORMAT JSON)
│   │   │   ├── ruleEngine.ts          # deterministic plan analysis (seq scans, missing indexes, join types, sorts)
│   │   │   └── explanation.service.ts # sends rule engine findings to Gemini, returns plain-English text
│   │   │
│   │   ├── nlToSql/
│   │   │   ├── nlToSql.routes.ts      # POST /api/nl-to-sql
│   │   │   ├── nlToSql.controller.ts
│   │   │   └── nlToSql.service.ts     # sends prompt to Gemini, returns SQL (never auto-executed)
│   │   │
│   │   └── applyIndex/
│   │       ├── applyIndex.routes.ts   # POST /api/apply-index
│   │       ├── applyIndex.controller.ts
│   │       └── applyIndex.service.ts  # ONLY accepts backend-generated CREATE INDEX statements,
│   │                                   # runs via a separate, narrowly-scoped DB role (not the read-only one)
│   │
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts     # express-rate-limit
│   │   └── requestLogger.ts
│   │
│   ├── app.ts                 # Express app setup: helmet, cors, JSON parsing, route mounting
│   └── server.ts              # entry point, starts the HTTP server
│
├── .env.example
├── package.json
└── tsconfig.json
```

## Frontend Folder Structure

```
client/
├── src/
│   ├── components/
│   │   ├── SqlEditor/          # Monaco wrapper
│   │   ├── SchemaExplorer/
│   │   ├── ResultsTable/
│   │   ├── PlanViewer/         # visualizes rule engine findings + explanation
│   │   └── ApplyIndexModal/    # confirmation modal before DDL runs
│   │
│   ├── api/
│   │   └── client.ts           # Axios instance, base URL from env
│   │
│   ├── pages/
│   │   └── Workspace.tsx       # main single-page layout combining the above
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── .env.example
├── package.json
└── tailwind.config.js
```

## Request Flow Contracts

### 1. Execute Query
`POST /api/query/execute`
Request: `{ sql: string }`
Flow: `query.validator` checks allowlist → `query.service` executes with 10s timeout, 500 row cap, read-only role → returns rows or a rejection reason.
Response: `{ rows: [...], rowCount: number, executionTimeMs: number }` or `{ error: string }`

### 2. Schema Explorer
`GET /api/schema/tables` → list of table names
`GET /api/schema/tables/:name` → columns, types, primary key, foreign keys, existing indexes

### 3. NL → SQL
`POST /api/nl-to-sql`
Request: `{ prompt: string }`
Response: `{ sql: string }` — frontend places this in the editor for review, never auto-runs it.

### 4. Explain (core feature)
`POST /api/explain`
Request: `{ sql: string }`
Flow:
1. `explain.service` runs `EXPLAIN (ANALYZE, FORMAT JSON)`
2. `ruleEngine.ts` parses the plan JSON, returns structured findings — this is plain deterministic code, e.g.:
   ```ts
   {
     issues: [
       { type: "SEQ_SCAN", table: "orders", rows: 120000, costEstimate: 1542, actualTimeMs: 460 }
     ],
     suggestedIndexes: [
       { table: "orders", column: "customer_id", statement: "CREATE INDEX idx_orders_customer ON orders(customer_id);" }
     ]
   }
   ```
3. `explanation.service` sends this structured JSON (not raw EXPLAIN output) to Gemini with a prompt asking it to explain the findings and the fix in plain English. **The rule engine decides what's wrong; Gemini only explains it.**

Response: `{ rawPlan: {...}, findings: {...}, explanation: string }`

### 5. Apply Suggested Index
`POST /api/apply-index`
Request: `{ statement: string }` — **must exactly match a statement previously generated by the rule engine in this session**; validated server-side against an in-memory store of the current session's suggestions, never accepts arbitrary DDL.

**Design correction (found during implementation):** the original design specified a dedicated `querylens_index_manager` role with schema-level `CREATE` privilege, intended to run this endpoint's DDL with least privilege. In practice, PostgreSQL requires **table ownership** to run `CREATE INDEX` on a pre-existing table — schema-level `CREATE` only permits creating brand-new objects, not indexing tables you don't own, and there is no finer-grained grant for this. Granting `querylens_index_manager` ownership of the table would give it far broader power (DROP, TRUNCATE, DELETE, UPDATE) than intended, which is a worse outcome than the problem it solves.

The corrected design: `/api/apply-index` executes via the superuser connection (`adminPool`, using `DATABASE_URL`). This is safe because the actual security boundary was never the DB role — it's the exact-string-match check against `suggestedIndexStore.ts`, an in-memory set populated *only* by the server's own rule engine output (never by client input). The rule engine only ever generates one fixed statement template (`CREATE INDEX idx_<table>_<column> ON <table>(<column>);`), so no client-controlled string can ever reach execution regardless of which connection runs it. `querylens_index_manager` remains defined at the database level but is unused by application code as of this correction.

Flow: runs via `adminPool` after `isKnownSuggestion()` passes.
Response: `{ success: true, data: { applied: true, statement } }` → frontend then re-runs the original query via `/api/query/execute` to show before/after timing.

## Database Roles (defined further in `database.md`)
- `querylens_readonly` — used by `/query/execute` and `/explain`. SELECT only.
- `querylens_index_manager` — defined at the DB level but unused by application code (see correction above — table ownership requirement makes it non-functional for its intended purpose).
- Superuser connection (`DATABASE_URL` / `adminPool`) — used only by `/apply-index`, gated entirely by the exact-match check against server-generated statements.

## Note on Gemini Model Names
Gemini model availability changes frequently — during this project's build, `gemini-2.5-flash` returned a 404 (deprecated for new API keys) and was replaced with `gemini-3.1-flash-lite`. If `config/gemini.ts` starts returning 404 errors in the future, check https://ai.google.dev/gemini-api/docs/changelog for the current recommended lightweight/fast model and update the model string there — this is the only place it's referenced.

## Environment Variables
```
DATABASE_URL=                  # superuser/admin connection, used only for setup scripts (schema/seed), not by the running app
DATABASE_URL_READONLY=         # used by /query/execute and /explain — SELECT-only role
DATABASE_URL_INDEX_MANAGER=    # used only by /apply-index — CREATE-only role, no SELECT/INSERT/UPDATE/DELETE
GEMINI_API_KEY=
PORT=
NODE_ENV=
```
`config/db.ts` exposes two separate connection pools (readonly and index-manager), selected per-route based on which DB role that feature is allowed to use — never a single shared pool with full privileges. Switching between local and Neon is a `.env` value change only — no code touches connection logic outside `config/db.ts`.

## Error Handling Convention
All routes throw to a central `errorHandler` middleware. Errors return: `{ error: { message: string, code: string } }`. No raw stack traces or SQL error internals returned to the client.
