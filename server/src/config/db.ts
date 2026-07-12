import { Pool } from 'pg';
import config from './env';

/**
 * Read-only pool — used by /api/query/execute and /api/explain.
 * Connects as `querylens_readonly` (SELECT only).
 */
export const readonlyPool = new Pool({
  connectionString: config.databaseUrlReadonly,
});

/**
 * Index-manager pool — used exclusively by /api/apply-index.
 * Connects as `querylens_index_manager` (CREATE INDEX only, no SELECT/INSERT/UPDATE/DELETE).
 */
export const indexManagerPool = new Pool({
  connectionString: config.databaseUrlIndexManager,
});

// DATABASE_URL (superuser) is intentionally NOT exposed here.
// It is used only by the setup scripts (schema.sql, seed.sql) run outside the app process.
