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
Request: `{ statement: string }` — **must exactly match a statement previously generated by the rule engine in this session**; validated server-side against a stored allowlist of the current session's suggestions, never accepts arbitrary DDL.
Flow: runs via a separate DB role with `CREATE INDEX` privilege only (no `DROP`, `ALTER`, `DELETE`, etc.) — distinct from the read-only role used for `/query/execute`.
Response: `{ success: true }` → frontend then re-runs the original query via `/api/query/execute` to show before/after timing.

## Database Roles (defined further in `database.md`)
- `querylens_readonly` — used by `/query/execute` and `/explain`. SELECT only.
- `querylens_index_manager` — used only by `/apply-index`. CREATE INDEX only, nothing else.

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
