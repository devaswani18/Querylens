import { useState } from 'react';
import SchemaExplorer from '../components/SchemaExplorer';
import SqlEditor from '../components/SqlEditor';
import ResultsTable from '../components/ResultsTable';
import PlanViewer from '../components/PlanViewer';
import ApplyIndexModal from '../components/ApplyIndexModal';
import client from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = 'results' | 'plan';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Findings = any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? fallback
  );
}

// ---------------------------------------------------------------------------
// Workspace — full-page layout + all shared state/handlers
// ---------------------------------------------------------------------------

export default function Workspace() {
  // ── SQL editor ─────────────────────────────────────────────────────────────
  const [sql, setSql] = useState('SELECT * FROM orders WHERE customer_id = 42');

  // ── Active tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('results');

  // ── Query execution ────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // ── Explain / plan ─────────────────────────────────────────────────────────
  const [isExplaining, setIsExplaining] = useState(false);
  const [findings, setFindings] = useState<Findings>(null);
  const [rawPlan, setRawPlan] = useState<object | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  // ── Apply-index modal ──────────────────────────────────────────────────────
  const [pendingStatement, setPendingStatement] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleRun() {
    setIsRunning(true);
    setQueryError(null);
    setActiveTab('results');
    try {
      const res = await client.post('/api/query/execute', { sql });
      const data = res.data.data;
      setRows(data.rows);
      setRowCount(data.rowCount);
      setExecutionTimeMs(data.executionTimeMs);
      setTruncated(data.truncated);
    } catch (err: unknown) {
      setQueryError(extractErrorMessage(err, 'Query failed.'));
      setRows(null);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleExplain() {
    setIsExplaining(true);
    setExplainError(null);
    try {
      const res = await client.post('/api/explain', { sql });
      const data = res.data.data;
      setFindings(data.findings);
      setRawPlan(data.rawPlan);
      setExplanation(data.explanation);
      // Automatically switch to the Plan tab so the user sees results immediately
      setActiveTab('plan');
    } catch (err: unknown) {
      setExplainError(extractErrorMessage(err, 'Explain failed.'));
      setFindings(null);
      setActiveTab('plan'); // Switch to plan tab to show the error banner
    } finally {
      setIsExplaining(false);
    }
  }

  function handleApplyIndexRequest(statement: string) {
    setApplyError(null);
    setPendingStatement(statement);
  }

  async function handleConfirmApply() {
    if (!pendingStatement) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      await client.post('/api/apply-index', { statement: pendingStatement });
      setPendingStatement(null);
      // Switch to Results tab and re-run to show the before/after improvement
      setActiveTab('results');
      await handleRun();
    } catch (err: unknown) {
      setApplyError(extractErrorMessage(err, 'Failed to apply index.'));
    } finally {
      setIsApplying(false);
    }
  }

  function handleCancelApply() {
    setPendingStatement(null);
    setApplyError(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">

      {/* ── Header ── */}
      <header className="flex h-12 shrink-0 items-center border-b border-slate-800 bg-slate-900 px-5">
        <span className="text-base font-semibold tracking-tight text-slate-100">
          QueryLens{' '}
          <span className="font-normal text-indigo-400">AI</span>
        </span>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 overflow-hidden border-r border-slate-800">
          <SchemaExplorer />
        </aside>

        {/* Main panel */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Editor + toolbar */}
          <div className="shrink-0 border-b border-slate-800 p-4">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={handleRun}
              isRunning={isRunning}
            />

            {/* Explain button — separate from SqlEditor's Run */}
            <div className="mt-2">
              <button
                onClick={handleExplain}
                disabled={isExplaining}
                className="flex items-center gap-1.5 rounded bg-violet-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExplaining ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyzing…
                  </>
                ) : (
                  '🔍 Explain Query'
                )}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex shrink-0 gap-0 border-b border-slate-800 bg-slate-900 px-4">
            {(['results', 'plan'] as const).map((tab) => {
              const labels: Record<ActiveTab, string> = {
                results: 'Results',
                plan: 'Execution Plan',
              };
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    px-4 py-2.5 text-sm font-medium transition-colors border-b-2
                    ${active
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                    }
                  `}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'results' && (
              <ResultsTable
                rows={rows}
                rowCount={rowCount}
                executionTimeMs={executionTimeMs}
                truncated={truncated}
                error={queryError}
              />
            )}
            {activeTab === 'plan' && (
              <PlanViewer
                findings={findings}
                rawPlan={rawPlan}
                explanation={explanation}
                isLoading={isExplaining}
                error={explainError}
                onApplyIndex={handleApplyIndexRequest}
              />
            )}
          </div>
        </main>
      </div>

      {/* Apply-index modal — portal-like, rendered outside the layout flow */}
      <ApplyIndexModal
        statement={pendingStatement}
        isApplying={isApplying}
        error={applyError}
        onConfirm={handleConfirmApply}
        onCancel={handleCancelApply}
      />
    </div>
  );
}
