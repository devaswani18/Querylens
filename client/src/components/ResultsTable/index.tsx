// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResultsTableProps {
  rows: Record<string, unknown>[] | null;
  rowCount: number;
  executionTimeMs: number | null;
  truncated: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a cell value safely — null → muted "NULL", objects → JSON string */
function renderCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-600 italic">NULL</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResultsTable({
  rows,
  rowCount,
  executionTimeMs,
  truncated,
  error,
}: ResultsTableProps) {
  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
        {error}
      </div>
    );
  }

  // ── Empty / idle state ───────────────────────────────────────────────────
  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-600 italic">
        Run a query to see results
      </div>
    );
  }

  // ── Empty result set ─────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-600 italic">
        Query returned no rows
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const columns = Object.keys(rows[0]);

  return (
    <div className="flex flex-col gap-2">
      {/* Meta bar */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>
          <span className="font-semibold text-slate-200">{rowCount}</span>{' '}
          {rowCount === 1 ? 'row' : 'rows'}
          {executionTimeMs !== null && (
            <>
              {' '}in{' '}
              <span className="font-semibold text-slate-200">
                {executionTimeMs}ms
              </span>
            </>
          )}
        </span>
        {truncated && (
          <span className="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 text-amber-300">
            Showing first 500 rows
          </span>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-slate-800 even:bg-slate-900 odd:bg-slate-950 hover:bg-slate-800 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-xs truncate px-3 py-1.5 text-slate-300 whitespace-nowrap"
                    title={
                      row[col] !== null && row[col] !== undefined
                        ? String(row[col])
                        : undefined
                    }
                  >
                    {renderCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
