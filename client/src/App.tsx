import { useState } from 'react';
import SchemaExplorer from './components/SchemaExplorer';
import SqlEditor from './components/SqlEditor';
import ResultsTable from './components/ResultsTable';
import client from './api/client';

// Temporary test wiring — will be replaced by Workspace.tsx layout later.
export default function App() {
  const [sql, setSql] = useState('SELECT * FROM orders WHERE customer_id = 42');
  const [isRunning, setIsRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setIsRunning(true);
    setError(null);
    try {
      const res = await client.post('/api/query/execute', { sql });
      const data = res.data.data;
      setRows(data.rows);
      setRowCount(data.rowCount);
      setExecutionTimeMs(data.executionTimeMs);
      setTruncated(data.truncated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Query failed.';
      setError(msg);
      setRows(null);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      <div className="w-64 border-r border-slate-800">
        <SchemaExplorer />
      </div>
      <div className="flex-1 p-4 flex flex-col gap-4">
        <SqlEditor
          value={sql}
          onChange={setSql}
          onRun={handleRun}
          isRunning={isRunning}
        />
        <ResultsTable
          rows={rows}
          rowCount={rowCount}
          executionTimeMs={executionTimeMs}
          truncated={truncated}
          error={error}
        />
      </div>
    </div>
  );
}