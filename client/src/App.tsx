import { useState } from 'react';
import SchemaExplorer from './components/SchemaExplorer';
import SqlEditor from './components/SqlEditor';
import ResultsTable from './components/ResultsTable';
import PlanViewer from './components/PlanViewer';
import ApplyIndexModal from './components/ApplyIndexModal';
import client from './api/client';

function extractErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? fallback
  );
}

// Temporary test wiring — will be replaced by Workspace.tsx layout later.
export default function App() {
  const [sql, setSql] = useState('SELECT * FROM orders WHERE customer_id = 42');

  // Query execution state
  const [isRunning, setIsRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Explain/plan state
  const [isExplaining, setIsExplaining] = useState(false);
  const [findings, setFindings] = useState<any>(null);
  const [rawPlan, setRawPlan] = useState<object | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Apply-index modal state
  const [pendingStatement, setPendingStatement] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handleRun() {
    setIsRunning(true);
    setQueryError(null);
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
    } catch (err: unknown) {
      setExplainError(extractErrorMessage(err, 'Explain failed.'));
      setFindings(null);
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
      // Re-run the original query to show the before/after improvement
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      <div className="w-64 border-r border-slate-800">
        <SchemaExplorer />
      </div>
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        <SqlEditor
          value={sql}
          onChange={setSql}
          onRun={handleRun}
          isRunning={isRunning}
        />

        <button
          onClick={handleExplain}
          disabled={isExplaining}
          className="self-start rounded bg-purple-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
        >
          {isExplaining ? 'Analyzing…' : 'Explain Query'}
        </button>

        <ResultsTable
          rows={rows}
          rowCount={rowCount}
          executionTimeMs={executionTimeMs}
          truncated={truncated}
          error={queryError}
        />

        <div className="border-t border-slate-800 pt-4">
          <PlanViewer
            findings={findings}
            rawPlan={rawPlan}
            explanation={explanation}
            isLoading={isExplaining}
            error={explainError}
            onApplyIndex={handleApplyIndexRequest}
          />
        </div>
      </div>

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