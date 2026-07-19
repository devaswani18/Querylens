import React from 'react';

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
    return <span className="font-mono text-fog/50 italic">NULL</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }
  return <span className="font-mono">{String(value)}</span>;
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
      <div className="rounded border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
        {error}
      </div>
    );
  }

  // ── Empty / idle state ───────────────────────────────────────────────────
  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-fog/60 italic">
        Run a query to see results
      </div>
    );
  }

  // ── Empty result set ─────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-fog/60 italic">
        Query returned no rows
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const columns = Object.keys(rows[0]);

  return (
    <div className="flex flex-col gap-2">
      {/* Meta bar */}
      <div className="flex items-center gap-3 text-xs text-fog">
        <span>
          <span className="font-mono font-semibold text-slate-100">{rowCount}</span>{' '}
          {rowCount === 1 ? 'row' : 'rows'}
          {executionTimeMs !== null && (
            <>
              {' '}in{' '}
              <span className="font-mono font-semibold text-slate-100">
                {executionTimeMs}ms
              </span>
            </>
          )}
        </span>
        {truncated && (
          <span className="rounded border border-signal/40 bg-signal/10 px-2 py-0.5 text-signal">
            Showing first 500 rows
          </span>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded border border-steel">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="border-b border-steel bg-ink">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-fog whitespace-nowrap"
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
                className="border-b border-steel/50 even:bg-ink odd:bg-void hover:bg-steel/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-xs truncate px-3 py-1.5 text-slate-200 whitespace-nowrap"
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
