import { readonlyPool } from '../../config/db';
import { validateQuery } from '../query/query.validator';
import { QueryRejectedError } from '../../middleware/errorHandler';

const STATEMENT_TIMEOUT_MS = 10_000; // 10 seconds — same as query.service.ts

/**
 * Runs EXPLAIN (ANALYZE, FORMAT JSON) against the read-only pool.
 *
 * - Only SELECT and WITH statements are accepted as input.
 *   EXPLAIN itself is rejected here — this service wraps it automatically.
 * - Enforces the same 10-second statement_timeout as query.service.ts.
 * - Returns the parsed plan object extracted from Postgres's JSON envelope.
 */
export async function runExplain(sql: string): Promise<object> {
  // ── Validate: allowlist check ────────────────────────────────────────────
  const validation = validateQuery(sql);
  if (!validation.allowed) {
    throw new QueryRejectedError(validation.reason ?? 'Query rejected.');
  }

  // ── Reject EXPLAIN as input — this endpoint wraps it automatically ───────
  // validateQuery allows EXPLAIN, but the explain endpoint must not accept a
  // statement that already starts with EXPLAIN (that would produce a nested
  // EXPLAIN EXPLAIN which is a syntax error, and is nonsensical UX).
  const leadingKeyword = extractLeadingKeyword(sql);
  if (leadingKeyword === 'EXPLAIN') {
    throw new QueryRejectedError(
      'Do not send an EXPLAIN statement to this endpoint — it wraps EXPLAIN automatically. Submit the SELECT or WITH query you want explained.',
    );
  }

  // ── Execute ──────────────────────────────────────────────────────────────
  const client = await readonlyPool.connect();
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

    // Strip trailing semicolon — it is a syntax error inside EXPLAIN (...)
    const sqlWithoutSemicolon = sql.trimEnd().replace(/;$/, '');
    const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${sqlWithoutSemicolon}`;

    const result = await client.query<{ 'QUERY PLAN': object[] }>(explainSql);

    // Postgres returns FORMAT JSON as a single row, single column named
    // "QUERY PLAN", whose value is a JSON array containing the plan tree.
    // We return the first (and only) element — the top-level plan node.
    const queryPlan = result.rows[0]['QUERY PLAN'];
    return queryPlan[0] as object;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Internal helper — mirrors query.service.ts; kept local to avoid coupling
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

function extractLeadingKeyword(sql: string): string {
  const match = stripLeadingCommentsAndWhitespace(sql).match(/^([A-Za-z_]+)/);
  return match ? match[1].toUpperCase() : '';
}
