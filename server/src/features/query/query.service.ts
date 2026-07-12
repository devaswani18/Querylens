import { readonlyPool } from '../../config/db';

const STATEMENT_TIMEOUT_MS = 10_000; // 10 seconds
const MAX_ROWS = 500;
const PROBE_LIMIT = MAX_ROWS + 1; // fetch one extra row to detect truncation without loading all rows

// ---------------------------------------------------------------------------
// Helpers — mirrors the comment-stripping logic in query.validator.ts so we
// can identify the leading keyword without importing the validator module
// (keeping the service layer free of validator coupling).
// ---------------------------------------------------------------------------

function stripLeadingCommentsAndWhitespace(sql: string): string {
  let s = sql.trimStart();
  let changed = true;
  while (changed) {
    changed = false;
    if (s.startsWith('--')) {
      const nlIdx = s.indexOf('\n');
      s = nlIdx === -1 ? '' : s.slice(nlIdx + 1).trimStart();
      changed = true;
    }
    if (s.startsWith('/*')) {
      const endIdx = s.indexOf('*/');
      s = endIdx === -1 ? '' : s.slice(endIdx + 2).trimStart();
      changed = true;
    }
  }
  return s;
}

function getLeadingKeyword(sql: string): string {
  const match = stripLeadingCommentsAndWhitespace(sql).match(/^([A-Za-z_]+)/);
  return match ? match[1].toUpperCase() : '';
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

/**
 * Executes a pre-validated SQL string against the read-only pool.
 *
 * - SELECT / WITH: wrapped in a subquery with LIMIT 501 so we never fetch
 *   more than one row beyond the cap, keeping memory usage bounded.
 * - EXPLAIN: executed unmodified (plan output is not tabular user data).
 * - Enforces a 10-second statement_timeout at the session level.
 * - Does NOT catch or swallow errors — lets them propagate to errorHandler.
 */
export async function executeQuery(sql: string): Promise<QueryResult> {
  const client = await readonlyPool.connect();

  try {
    // Set statement timeout for this specific connection before executing.
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

    const keyword = getLeadingKeyword(sql);
    const isExplain = keyword === 'EXPLAIN';

    let queryToRun: string;
    if (isExplain) {
      // EXPLAIN output is a small plan JSON — never needs row capping.
      queryToRun = sql;
    } else {
      // SELECT / WITH: wrap in a subquery and fetch at most PROBE_LIMIT rows.
      // Strip a trailing semicolon from the original query before wrapping
      // (a semicolon inside a subquery is a syntax error in PostgreSQL).
      const sqlWithoutTrailingSemicolon = sql.trimEnd().replace(/;$/, '');
      queryToRun =
        `SELECT * FROM (${sqlWithoutTrailingSemicolon}) AS querylens_subquery LIMIT ${PROBE_LIMIT}`;
    }

    const start = Date.now();
    const result = await client.query(queryToRun);
    const executionTimeMs = Date.now() - start;

    const allRows = result.rows as Record<string, unknown>[];

    let rows: Record<string, unknown>[];
    let truncated: boolean;

    if (!isExplain && allRows.length === PROBE_LIMIT) {
      // We got the extra sentinel row — the real result set exceeds MAX_ROWS.
      rows = allRows.slice(0, MAX_ROWS);
      truncated = true;
    } else {
      rows = allRows;
      truncated = false;
    }

    return {
      rows,
      rowCount: rows.length,
      executionTimeMs,
      truncated,
    };
  } finally {
    // Always release the client back to the pool, even on error.
    client.release();
  }
}
