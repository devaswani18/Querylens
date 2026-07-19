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
    <div className="flex items-center gap-1 px-3 py-2 text-fog text-sm">
      <span className="animate-pulse">●</span>
      <span className="animate-pulse [animation-delay:150ms]">●</span>
      <span className="animate-pulse [animation-delay:300ms]">●</span>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mx-2 my-1 rounded border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
      {message}
    </div>
  );
}

// Column badge for PK / FK — visually distinct from each other
function Badge({ label, title }: { label: string; title?: string }) {
  const colours =
    label === 'PK'
      ? 'bg-signal text-void'              // amber-fill, dark text — primary key
      : 'bg-pulse/20 text-pulse';          // teal tint — foreign key
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
    <div className="border-t border-steel bg-ink px-3 py-2">
      {/* Columns */}
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-fog">
        Columns
      </p>
      <ul className="mb-3 space-y-0.5">
        {details.columns.map((col) => (
          <li key={col.name} className="flex items-center text-xs">
            <span className="font-mono text-slate-100">{col.name}</span>
            <span className="ml-2 text-fog">{col.type}</span>
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
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-fog">
            Indexes
          </p>
          <ul className="space-y-0.5">
            {details.indexes.map((idx) => (
              <li key={idx.name} className="text-xs">
                <span className="font-mono text-slate-200">{idx.name}</span>
                {idx.isUnique && (
                  <span className="ml-1 text-[10px] text-pulse">
                    UNIQUE
                  </span>
                )}
                <span className="ml-1 text-fog">
                  ({idx.columns.join(', ')})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {details.indexes.length === 0 && (
        <p className="text-xs text-fog/50 italic">No indexes</p>
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
    <li className="border-b border-steel last:border-0">
      <button
        onClick={toggleExpand}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-steel active:bg-steel/70 transition-colors"
      >
        {/* Chevron */}
        <span
          className={`text-fog transition-transform duration-150 ${
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
      <div className="flex items-center justify-between border-b border-steel px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-fog">
          Schema
        </span>
        {loading && (
          <span className="text-[10px] text-fog/50 animate-pulse">
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
          <p className="px-3 py-4 text-xs text-fog/50 italic">
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
