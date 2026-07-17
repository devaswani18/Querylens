import { readonlyPool } from '../../config/db';
import { NotFoundError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Return types (matching docs/api.md exactly)
// ---------------------------------------------------------------------------

export interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface TableDetails {
  table: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

// ---------------------------------------------------------------------------
// getTables
// ---------------------------------------------------------------------------

/**
 * Returns all user-created table names in the public schema, sorted alphabetically.
 */
export async function getTables(): Promise<string[]> {
  const result = await readonlyPool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type  = 'BASE TABLE'
     ORDER BY table_name ASC`,
  );
  return result.rows.map((r) => r.table_name);
}

// ---------------------------------------------------------------------------
// getTableDetails
// ---------------------------------------------------------------------------

/**
 * Returns full column, index, primary-key and foreign-key detail for a single table.
 * Throws NotFoundError if the table does not exist in the public schema.
 *
 * All queries use parameterized placeholders — tableName is never concatenated
 * into SQL strings, preventing SQL injection through the route parameter.
 */
export async function getTableDetails(tableName: string): Promise<TableDetails> {
  // ── 1. Verify the table exists ──────────────────────────────────────────
  const existsResult = await readonlyPool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type   = 'BASE TABLE'
       AND table_name   = $1`,
    [tableName],
  );

  if (existsResult.rows.length === 0) {
    throw new NotFoundError(`Table "${tableName}" does not exist in this database.`);
  }

  // ── 2. Columns (name, type, nullable) ───────────────────────────────────
  const columnsResult = await readonlyPool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = $1
     ORDER BY ordinal_position ASC`,
    [tableName],
  );

  // ── 3. Primary key column names (pg_catalog) ────────────────────────────
  //
  // information_schema constraint views require the querying role to own the
  // objects or hold a relevant privilege — the readonly role can't see them.
  // pg_catalog tables are visible to every role.
  //
  // Join path:
  //   pg_constraint (contype='p')  →  pg_class (the table)  →  pg_namespace
  //   unnest(c.conkey) gives the attnum of each PK column
  //   pg_attribute maps attnum → column name
  const pkResult = await readonlyPool.query<{ column_name: string }>(
    `SELECT a.attname AS column_name
     FROM pg_constraint  c
     JOIN pg_class       t  ON t.oid = c.conrelid
     JOIN pg_namespace   n  ON n.oid = t.relnamespace
     JOIN pg_attribute   a  ON a.attrelid = t.oid
                           AND a.attnum   = ANY(c.conkey)
     WHERE n.nspname  = 'public'
       AND t.relname  = $1
       AND c.contype  = 'p'`,
    [tableName],
  );
  const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));

  // ── 4. Foreign key columns → referenced table / column (pg_catalog) ─────
  //
  // conkey[]   = attnums of the constrained (local) columns
  // confkey[]  = attnums of the referenced columns, positionally paired with conkey
  //
  // unnest(c.conkey, c.confkey) WITH ORDINALITY ensures conkey[i] is always
  // matched with confkey[i] — never rely on a second join that could reorder rows.
  //
  // Join path:
  //   pg_constraint (contype='f')
  //     conrelid  →  pg_class (local table)   →  pg_namespace
  //     confrelid →  pg_class (foreign table)
  //   unnest pairs (local_attnum, ref_attnum)
  //     local_attnum  →  pg_attribute (local column name)
  //     ref_attnum    →  pg_attribute (referenced column name)
  const fkResult = await readonlyPool.query<{
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(
    `SELECT
       la.attname   AS column_name,
       ft.relname   AS foreign_table_name,
       fa.attname   AS foreign_column_name
     FROM pg_constraint  c
     JOIN pg_class       lt  ON lt.oid = c.conrelid
     JOIN pg_namespace   n   ON n.oid  = lt.relnamespace
     JOIN pg_class       ft  ON ft.oid = c.confrelid
     JOIN LATERAL unnest(c.conkey, c.confkey)
          WITH ORDINALITY AS u(local_attnum, ref_attnum, ord)
          ON TRUE
     JOIN pg_attribute   la  ON la.attrelid = lt.oid AND la.attnum = u.local_attnum
     JOIN pg_attribute   fa  ON fa.attrelid = ft.oid AND fa.attnum = u.ref_attnum
     WHERE n.nspname  = 'public'
       AND lt.relname = $1
       AND c.contype  = 'f'
     ORDER BY c.oid, u.ord`,
    [tableName],
  );

  // Map column_name → FK reference for quick lookup
  const fkMap = new Map<string, { referencesTable: string; referencesColumn: string }>();
  for (const row of fkResult.rows) {
    fkMap.set(row.column_name, {
      referencesTable: row.foreign_table_name,
      referencesColumn: row.foreign_column_name,
    });
  }

  // ── 5. Assemble column objects ───────────────────────────────────────────
  const columns: ColumnInfo[] = columnsResult.rows.map((col) => {
    const fkRef = fkMap.get(col.column_name);
    const info: ColumnInfo = {
      name: col.column_name,
      type: col.data_type,
      isPrimaryKey: pkColumns.has(col.column_name),
      isForeignKey: fkMap.has(col.column_name),
    };
    if (fkRef) {
      info.referencesTable = fkRef.referencesTable;
      info.referencesColumn = fkRef.referencesColumn;
    }
    return info;
  });

  // ── 6. Indexes ───────────────────────────────────────────────────────────
  const indexResult = await readonlyPool.query<{
    indexname: string;
    indexdef: string;
  }>(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = $1
     ORDER BY indexname ASC`,
    [tableName],
  );

  const indexes: IndexInfo[] = indexResult.rows.map((idx) => {
    // Parse column names from the indexdef expression.
    // pg_indexes.indexdef looks like:
    //   CREATE [UNIQUE] INDEX <name> ON <schema>.<table> USING <method> (<col1>, <col2>)
    const colMatch = idx.indexdef.match(/\(([^)]+)\)$/);
    const rawCols = colMatch ? colMatch[1] : '';
    const indexColumns = rawCols
      .split(',')
      .map((c) => c.trim().split(/\s+/)[0]) // take only the column name, drop ASC/DESC/etc.
      .filter(Boolean);

    return {
      name: idx.indexname,
      columns: indexColumns,
      isUnique: /\bUNIQUE\b/i.test(idx.indexdef),
    };
  });

  return { table: tableName, columns, indexes };
}
