import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Issue {
  type: string;
  table?: string;
  rows?: number;
  costEstimate?: number;
  actualTimeMs?: number;
}

interface SuggestedIndex {
  table: string;
  column: string;
  statement: string;
}

interface Findings {
  issues: Issue[];
  suggestedIndexes: SuggestedIndex[];
}

interface PlanViewerProps {
  findings: Findings | null;
  rawPlan: object | null;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  onApplyIndex: (statement: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ISSUE_LABELS: Record<string, string> = {
  SEQ_SCAN: 'Sequential Scan',
  INEFFICIENT_JOIN: 'Inefficient Join',
  DISK_SORT: 'Disk Sort',
};

const ISSUE_ICONS: Record<string, string> = {
  SEQ_SCAN: '⚠',
  INEFFICIENT_JOIN: '⚡',
  DISK_SORT: '💾',
};

function issueLabel(type: string): string {
  return ISSUE_LABELS[type] ?? type;
}

function issueIcon(type: string): string {
  return ISSUE_ICONS[type] ?? '⚠';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const label = issueLabel(issue.type);
  const icon = issueIcon(issue.type);

  return (
    <div className="rounded border border-amber-800/50 bg-amber-950/40 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-sm font-semibold text-amber-300">{label}</span>
        {issue.table && (
          <span className="font-mono text-xs text-slate-400">
            on &quot;{issue.table}&quot;
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
        {issue.rows !== undefined && (
          <span>
            <span className="font-semibold text-slate-200">
              {issue.rows.toLocaleString()}
            </span>{' '}
            rows scanned
          </span>
        )}
        {issue.actualTimeMs !== undefined && (
          <span>
            <span className="font-semibold text-slate-200">
              {issue.actualTimeMs.toFixed(2)}ms
            </span>{' '}
            actual time
          </span>
        )}
        {issue.costEstimate !== undefined && (
          <span>
            cost estimate{' '}
            <span className="font-semibold text-slate-200">
              {issue.costEstimate.toFixed(1)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function IndexSuggestion({
  idx,
  onApply,
}: {
  idx: SuggestedIndex;
  onApply: (statement: string) => void;
}) {
  return (
    <div className="rounded border border-slate-700 bg-slate-800/60 px-4 py-3">
      <div className="mb-2 text-xs text-slate-400">
        Suggested index on{' '}
        <span className="font-mono text-slate-200">
          {idx.table}.{idx.column}
        </span>
      </div>
      <pre className="mb-3 overflow-x-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300">
        {idx.statement}
      </pre>
      <button
        onClick={() => onApply(idx.statement)}
        className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 active:bg-emerald-800"
      >
        Apply Suggested Index
      </button>
    </div>
  );
}

function RawPlanToggle({ rawPlan }: { rawPlan: object }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-slate-700">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
      >
        <span className="font-medium">View Raw Execution Plan</span>
        <span
          className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-slate-700 bg-slate-900 px-4 py-3 font-mono text-[11px] text-slate-300">
          {JSON.stringify(rawPlan, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlanViewer — root component
// ---------------------------------------------------------------------------

export default function PlanViewer({
  findings,
  rawPlan,
  explanation,
  isLoading,
  error,
  onApplyIndex,
}: PlanViewerProps) {
  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        Analyzing query plan…
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return <InlineError message={error} />;
  }

  // ── Empty / idle ─────────────────────────────────────────────────────────
  if (!findings) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-600 italic">
        Run &ldquo;Explain Query&rdquo; to analyze performance
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const hasIssues = findings.issues.length > 0;
  const hasIndexes = findings.suggestedIndexes.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Explanation callout ── */}
      {explanation !== null ? (
        <div className="rounded border border-indigo-700/60 bg-indigo-950/50 px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
            AI Explanation
          </p>
          <p className="text-sm leading-relaxed text-slate-200">{explanation}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">
          AI explanation unavailable, showing raw findings
        </p>
      )}

      {/* ── Issues ── */}
      {hasIssues && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Issues found
          </p>
          {findings.issues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}

      {!hasIssues && (
        <p className="text-sm text-emerald-500">
          ✓ No performance issues detected.
        </p>
      )}

      {/* ── Suggested indexes ── */}
      {hasIndexes && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Suggested indexes
          </p>
          {findings.suggestedIndexes.map((idx, i) => (
            <IndexSuggestion key={i} idx={idx} onApply={onApplyIndex} />
          ))}
        </div>
      )}

      {/* ── Raw plan (collapsible) ── */}
      {rawPlan && <RawPlanToggle rawPlan={rawPlan} />}
    </div>
  );
}
