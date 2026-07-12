# QueryLens AI — Requirements (V1)

## Resume Headline
An AI-powered database performance and optimization assistant that helps developers understand, analyze, and optimize PostgreSQL queries using execution plans, intelligent recommendations, and natural language interaction.

**Not:** "Chat with your database" or "SQL generator."
**Is:** A database performance & optimization tool that happens to use AI for explanation and translation.

## Problem Statement
Developers write slow SQL and don't know why. Reading raw `EXPLAIN ANALYZE` JSON output requires expertise most junior/mid developers don't have. QueryLens bridges that gap: it runs the query, analyzes the actual execution plan with deterministic rules, and explains the findings and fixes in plain English — then lets you verify the fix with a live before/after comparison.

## V1 Scope — Must-Have Features

1. **SQL Editor**
   - Monaco Editor (VS Code-like), syntax highlighting, run button, query history (session-only, no persistence required for V1)

2. **Safe Query Execution**
   - Allow only: `SELECT`, `WITH`, `EXPLAIN`
   - Reject: `DELETE`, `DROP`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `CREATE` (except via the dedicated apply-index endpoint below)
   - Max 500 rows returned, 10-second timeout
   - Runs against a read-only DB role

3. **Schema Explorer**
   - List tables → click table → show columns, types, primary key, foreign keys, existing indexes

4. **Natural Language → SQL** (supporting feature, not the headline)
   - User types plain English → Gemini generates a SQL query → user reviews before running it. Never auto-executed.

5. **Execution Plan Intelligence** (⭐ core differentiator)
   - Runs `EXPLAIN (ANALYZE, FORMAT JSON)` on the query
   - Deterministic rule engine (plain code, not AI) parses the plan JSON and detects: sequential scans on large tables, missing indexes on filtered/joined columns, join types (nested loop / hash / merge), sort operations, and their cost/row/time figures
   - Gemini takes the rule engine's structured findings and generates a plain-English explanation — the AI explains, it does not decide what's wrong

6. **Apply Suggested Index (demo feature)**
   - "Apply Suggested Index" button → confirmation modal shows the exact `CREATE INDEX` statement → user confirms → backend runs it via a dedicated, restricted endpoint that only accepts backend-generated DDL (never free-text user input), using a separate, narrowly-scoped DB role
   - Re-run the original query → show before/after execution time comparison (the "wow moment")

## Explicitly Out of Scope for V1 (→ README Roadmap section)
- Authentication / user accounts
- Database health score
- Query rewrite suggestions
- ER diagram generation
- Deadlock detection
- Missing foreign key detection
- Duplicate index detection
- Slow query history / persistence across sessions
- "Chat with your database" open-ended Q&A
- Multi-database support (MySQL, Oracle, etc.)

## Tech Stack (Final)
- **Frontend:** React, TypeScript, Tailwind CSS, Monaco Editor, Axios
- **Backend:** Node.js, Express (single backend — no separate Python service)
  - Libraries: `pg`, `dotenv`, `cors`, `helmet`, `express-rate-limit`
- **Rule Engine:** plain TypeScript/JS logic inside the Express backend (not AI-driven)
- **AI:** Gemini 2.5 Flash API, called directly from Express (free tier: ~1,500 requests/day, no credit card, no expiration — sufficient for this project's needs)
- **Database:** PostgreSQL
  - Local Postgres for development
  - Neon (serverless Postgres) for production
  - Connection fully driven by `DATABASE_URL` environment variable — switching environments requires only a `.env` change, never a code change

## Deployment
- Frontend → Vercel
- Backend → Railway
- Database → Neon (production), local Postgres (development)

## Success Criteria (what "done" means)
- User can write/run a SELECT query and see results in under 10 seconds
- User can view schema for any table in the sample database
- User can type a plain-English request and get a working SQL query back
- User can run a deliberately slow query (missing index) and get: a correct rule-based diagnosis, an AI-generated plain-English explanation, a specific index recommendation, and a working "before/after" performance comparison after applying it
- Entire flow works end-to-end in a live demo without manual intervention or errors
- README clearly documents architecture, security decisions, and roadmap

## Sample Data Requirement
Seed database needs realistic scale — minimum 50,000–100,000 rows in the primary demo table (e.g. Orders) so sequential scans are measurably slow (100ms+) and the indexed version shows a dramatic, honest improvement. Toy-sized data (a few hundred rows) will not produce a convincing demo.
