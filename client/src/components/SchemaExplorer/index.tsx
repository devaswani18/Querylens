import { useState, useEffect } from 'react';
import client from '../../api/client';

// ---------------------------------------------------------------------------
// Types — shaped after docs/api.md Schema Explorer responses
// ---------------------------------------------------------------------------

interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

interface TableDetails {
  table: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 text-slate-400 text-sm">
      <span className="animate-pulse">●</span>
      <span className="animate-pulse [animation-delay:150ms]">●</span>
      <span className="animate-pulse [animation-delay:300ms]">●</span>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mx-2 my-1 rounded border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-300">
      {message}
    </div>
  );
}

// Column badge for PK / FK
function Badge({ label, title }: { label: string; title?: string }) {
  const colours =
    label === 'PK'
      ? 'bg-amber-700 text-amber-100'
      : 'bg-sky-800 text-sky-100';
  return (
    <span
      title={title}
      className={`ml-1 rounded px-1 py-0.5 text-[10px] font-bold leading-none ${colours}`}
    >
      {label}
    </span>
  );
}

// Expanded table panel — columns + indexes
function TablePanel({ details }: { details: TableDetails }) {
  return (
    <div className="border-t border-slate-700 bg-slate-900 px-3 py-2">
      {/* Columns */}
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Columns
      </p>
      <ul className="mb-3 space-y-0.5">
        {details.columns.map((col) => (
          <li key={col.name} className="flex items-center text-xs">
            <span className="font-mono text-slate-200">{col.name}</span>
            <span className="ml-2 text-slate-500">{col.type}</span>
            {col.isPrimaryKey && <Badge label="PK" title="Primary key" />}
            {col.isForeignKey && (
              <Badge
                label="FK"
                title={`References ${col.referencesTable}.${col.referencesColumn}`}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Indexes */}
      {details.indexes.length > 0 && (
        <>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Indexes
          </p>
          <ul className="space-y-0.5">
            {details.indexes.map((idx) => (
              <li key={idx.name} className="text-xs">
                <span className="font-mono text-slate-300">{idx.name}</span>
                {idx.isUnique && (
                  <span className="ml-1 text-[10px] text-emerald-400">
                    UNIQUE
                  </span>
                )}
                <span className="ml-1 text-slate-500">
                  ({idx.columns.join(', ')})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {details.indexes.length === 0 && (
        <p className="text-xs text-slate-600 italic">No indexes</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableRow — individual table name in the sidebar list
// ---------------------------------------------------------------------------

function TableRow({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<TableDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    // Already fetched — no need to refetch
    if (details) return;

    setLoading(true);
    setError(null);
    try {
      const res = await client.get<{ success: true; data: TableDetails }>(
        `/api/schema/tables/${encodeURIComponent(name)}`,
      );
      setDetails(res.data.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        'Failed to load table details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="border-b border-slate-800 last:border-0">
      <button
        onClick={toggleExpand}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 active:bg-slate-600 transition-colors"
      >
        {/* Chevron */}
        <span
          className={`text-slate-500 transition-transform duration-150 ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          ▶
        </span>
        <span className="font-mono">{name}</span>
      </button>

      {expanded && (
        <>
          {loading && <LoadingDots />}
          {error && <InlineError message={error} />}
          {details && <TablePanel details={details} />}
        </>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// SchemaExplorer — root component
// ---------------------------------------------------------------------------

export default function SchemaExplorer() {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTables() {
      setLoading(true);
      setError(null);
      try {
        const res = await client.get<{
          success: true;
          data: { tables: string[] };
        }>('/api/schema/tables');
        if (!cancelled) {
          setTables(res.data.data.tables);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message ??
            'Failed to load schema.';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTables();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Schema
        </span>
        {loading && (
          <span className="text-[10px] text-slate-600 animate-pulse">
            loading…
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <InlineError message={error} />
        )}

        {!loading && !error && tables.length === 0 && (
          <p className="px-3 py-4 text-xs text-slate-600 italic">
            No tables found in public schema.
          </p>
        )}

        {tables.length > 0 && (
          <ul>
            {tables.map((name) => (
              <TableRow key={name} name={name} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
