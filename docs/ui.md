# QueryLens AI — UI (V1)

Refer to `docs/architecture.md` for the underlying component folders and `docs/api.md` for the data each component consumes.

## Layout (Single Page)

```
┌─────────────────────────────────────────────────────────┐
│  Header: "QueryLens AI"                                  │
├───────────────┬─────────────────────────────────────────┤
│                │  SQL Editor (Monaco)                    │
│  Schema        │  [Run Query]  [Ask in Plain English]    │
│  Explorer      ├─────────────────────────────────────────┤
│  (sidebar,     │  Results Table  /  Plan Viewer           │
│  tables list)  │  (tabbed: "Results" | "Execution Plan")  │
│                │                                          │
└───────────────┴─────────────────────────────────────────┘
```

## Components

### `SchemaExplorer`
- Fetches `GET /api/schema/tables` on mount
- Click a table → fetches `GET /api/schema/tables/:name` → expands to show columns/PK/FK/indexes
- States: loading, loaded, error (toast, non-blocking)

### `SqlEditor`
- Monaco instance, SQL syntax highlighting
- "Run Query" button → calls `POST /api/query/execute`, shows result in `ResultsTable`
- "Ask in Plain English" → opens a small input → calls `POST /api/nl-to-sql` → inserts returned SQL into the editor (does not run it — user must click Run)
- "Explain This Query" button (separate from Run) → calls `POST /api/explain` → switches active tab to `PlanViewer`
- States: idle, running (disable buttons + spinner), error (inline banner with `error.message`)

### `ResultsTable`
- Renders `data.rows` from `/query/execute`
- Shows `rowCount`, `executionTimeMs` above the table
- If `truncated: true`, show a small note: "Showing first 500 rows"
- Empty state: "Query returned no rows"

### `PlanViewer` (core feature — give this the most design attention)
- Top: plain-English `explanation` text in a highlighted callout box
- Middle: `findings.issues` rendered as cards, one per issue — e.g.:
  ```
  ⚠ Sequential Scan on "orders"
  150,000 rows scanned · 461ms · cost estimate 3204.5
  ```
- Bottom: `findings.suggestedIndexes`, each with an **"Apply Suggested Index"** button
- Collapsible "View Raw Execution Plan" section showing `rawPlan` JSON, collapsed by default (for the curious/technical viewer, not the main flow)
- If `explanation` is null (Gemini failed but rule engine succeeded) — still show `findings`, just omit the callout box and show a small note: "AI explanation unavailable, showing raw findings"

### `ApplyIndexModal`
- Triggered by "Apply Suggested Index" button
- Shows the exact `CREATE INDEX` statement in a read-only code block
- "Confirm" → calls `POST /api/apply-index` → on success, automatically re-runs the original query and shows a before/after comparison:
  ```
  Before: 461ms  →  After: 38ms   (92% faster)
  ```
- "Cancel" closes without action
- This is the demo's "wow moment" — keep the before/after comparison visually prominent (large numbers, clear arrow/delta), not buried in text

## Global States
- **Loading:** every async action shows a spinner/disabled state on its trigger button — never a blank screen
- **Error:** non-blocking toast/banner using `error.message` from the API envelope; never show raw error codes to the user
- **Empty:** each panel (schema list, results table, plan viewer) has a distinct empty state message before first use

## Explicitly Out of Scope for V1 UI
- No dark/light theme toggle (pick one, Tailwind default dark theme is fine and looks professional for a dev tool)
- No responsive/mobile layout — this is a desktop developer tool
- No multi-tab query history UI (session-only history is enough per `requirements.md`)
