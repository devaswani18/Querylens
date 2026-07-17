import { adminPool } from '../../config/db';
import { IndexStatementMismatchError } from '../../middleware/errorHandler';
import { isKnownSuggestion } from './suggestedIndexStore';

/**
 * Applies a previously rule-engine-generated CREATE INDEX statement.
 *
 * Security model:
 * - The statement must exactly match one recorded by the rule engine via
 *   suggestedIndexStore. This exact-match check is the real safety control —
 *   no arbitrary client-supplied DDL can ever reach the database.
 * - Execution uses adminPool (superuser connection) because PostgreSQL requires
 *   table ownership to CREATE INDEX on pre-existing tables. There is no
 *   grantable privilege that allows a non-owning role to do this, so the
 *   querylens_index_manager role's schema-level CREATE privilege is insufficient.
 * - No additional SQL parsing of the statement is performed: membership in the
 *   server's own store — written exclusively by the rule engine — is what makes
 *   the statement trustworthy.
 */
export async function applyIndex(statement: string): Promise<void> {
  if (!isKnownSuggestion(statement)) {
    throw new IndexStatementMismatchError();
  }

  await adminPool.query(statement);
}
