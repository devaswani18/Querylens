# QueryLens AI — Roadmap

Everything below is explicitly **not** in V1 (see `docs/requirements.md`). Listed here to show product thinking without spending build time on it during the 20-day window.

## Near-Term (V2 candidates)
- **Authentication** — user accounts, saved query history persisted across sessions
- **Query Rewrite Suggestions** — beyond index recommendations, suggest structural query rewrites (e.g. replacing correlated subqueries with joins)
- **Database Health Score** — aggregate metric from `pg_stat_*` views (cache hit ratio, dead tuples, table bloat)
- **Slow Query History** — persist and list past explained queries with their findings over time

## Medium-Term
- **ER Diagram Generation** — auto-generate a visual schema diagram (Mermaid.js) from the foreign key relationships already surfaced by the Schema Explorer
- **Duplicate Index Detection** — flag redundant indexes covering the same columns
- **Missing Foreign Key Detection** — flag columns that look like they reference another table but lack a formal FK constraint

## Long-Term / Exploratory
- **Deadlock Detection** — surface lock contention and deadlock patterns from `pg_locks`
- **Normalization Suggestions** — flag denormalization patterns and suggest schema improvements
- **Multi-Database Support** — MySQL, then Oracle — would require abstracting the currently Postgres-specific `EXPLAIN` parsing and rule engine
- **"Chat with Your Database" open-ended Q&A** — deliberately excluded even long-term unless scoped very specifically; open-ended chat is the saturated, low-differentiation pattern this project was designed to avoid

## Why This List Exists
Interviewers and reviewers respond well to a clear, honest boundary between "what I built" and "what I'd build next" — it signals scope discipline rather than an unfinished project. This list should be referenced directly in the final project README.
