export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Allowlist: only these keywords may lead a SQL statement.
 * Everything else is rejected.
 */
const ALLOWED_LEADING_KEYWORDS = ['SELECT', 'WITH', 'EXPLAIN'] as const;

/**
 * Explicitly blocked keywords — used to produce a clear rejection message.
 * The allowlist already rejects anything not in ALLOWED_LEADING_KEYWORDS,
 * but we surface these names so the error message is actionable.
 */
const BLOCKED_LEADING_KEYWORDS = [
  'DELETE',
  'DROP',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'GRANT',
  'REVOKE',
] as const;

/**
 * Strip leading whitespace and single-line (--) / multi-line (/* ... *\/) SQL comments
 * to get to the actual first keyword of the statement.
 */
function stripLeadingCommentsAndWhitespace(sql: string): string {
  let s = sql.trimStart();

  let changed = true;
  while (changed) {
    changed = false;

    // Strip -- single-line comments
    if (s.startsWith('--')) {
      const newlineIdx = s.indexOf('\n');
      s = newlineIdx === -1 ? '' : s.slice(newlineIdx + 1).trimStart();
      changed = true;
    }

    // Strip /* ... */ block comments
    if (s.startsWith('/*')) {
      const endIdx = s.indexOf('*/');
      s = endIdx === -1 ? '' : s.slice(endIdx + 2).trimStart();
      changed = true;
    }
  }

  return s;
}

/**
 * Extracts the leading keyword from a (comment-stripped) SQL string.
 * Returns it uppercased.
 */
function extractLeadingKeyword(sql: string): string {
  const match = sql.match(/^([A-Za-z_]+)/);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Replace the contents of single-quoted string literals with placeholder
 * characters so that semicolons inside string values don't get mistaken
 * for statement separators.
 *
 * Handles '' as an escaped single-quote inside a literal.
 */
function stripStringLiterals(sql: string): string {
  let result = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'") {
      result += "'";
      i++;
      // Consume everything inside the string literal
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          // Escaped quote inside the literal — consume both characters
          result += "__"; // placeholder, two chars to preserve offsets loosely
          i += 2;
        } else if (sql[i] === "'") {
          // Closing quote
          result += "'";
          i++;
          break;
        } else {
          result += '_'; // placeholder for literal content
          i++;
        }
      }
    } else {
      result += sql[i];
      i++;
    }
  }
  return result;
}

/**
 * Returns true if the SQL string contains more than one statement.
 *
 * Algorithm:
 *  1. Strip string literal contents (so semicolons inside strings are ignored).
 *  2. Find the rightmost semicolon.
 *  3. If there is any non-whitespace character after that semicolon,
 *     there is a second statement → reject.
 *  4. If there is a semicolon that is NOT at/near the end (i.e. there is
 *     another semicolon before the last one, or there is real content after
 *     the first semicolon), → reject.
 *
 * A single trailing semicolon (with only optional whitespace after it) is
 * always permitted.
 */
function hasMultipleStatements(sql: string): boolean {
  const stripped = stripStringLiterals(sql);
  const firstSemicolon = stripped.indexOf(';');
  if (firstSemicolon === -1) {
    // No semicolons at all — definitely a single statement.
    return false;
  }
  // Everything after the first semicolon (skip the semicolon itself)
  const afterFirst = stripped.slice(firstSemicolon + 1);
  // If there is any non-whitespace content after the first semicolon,
  // a second statement is present.
  return afterFirst.trim().length > 0;
}

/**
 * Validates a raw SQL string against the allowlist.
 *
 * @returns `{ allowed: true }` for SELECT / WITH / EXPLAIN statements.
 *          `{ allowed: false, reason: string }` for everything else.
 */
export function validateQuery(sql: string): ValidationResult {
  if (!sql || sql.trim().length === 0) {
    return { allowed: false, reason: 'SQL statement cannot be empty.' };
  }

  const stripped = stripLeadingCommentsAndWhitespace(sql);
  if (!stripped) {
    return { allowed: false, reason: 'SQL statement cannot be empty.' };
  }

  const keyword = extractLeadingKeyword(stripped);

  if ((ALLOWED_LEADING_KEYWORDS as readonly string[]).includes(keyword)) {
    // Keyword is on the allowlist — now check for multiple statements.
    if (hasMultipleStatements(sql)) {
      return {
        allowed: false,
        reason:
          'Multiple statements are not permitted. Submit one statement at a time.',
      };
    }
    return { allowed: true };
  }

  if ((BLOCKED_LEADING_KEYWORDS as readonly string[]).includes(keyword)) {
    return {
      allowed: false,
      reason: `Statement type "${keyword}" is not permitted. Only SELECT, WITH, and EXPLAIN statements are allowed.`,
    };
  }

  return {
    allowed: false,
    reason: `Unknown or unsupported statement type "${keyword}". Only SELECT, WITH, and EXPLAIN statements are allowed.`,
  };
}
