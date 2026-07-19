import { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning: boolean;
  /** Calls the nl-to-sql API and resolves with the generated SQL string. */
  onAskAi: (prompt: string) => Promise<string>;
  /** True while the nl-to-sql request is in flight — disables the AI input. */
  isAskingAi: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SqlEditor({
  value,
  onChange,
  onRun,
  isRunning,
  onAskAi,
  isAskingAi,
}: SqlEditorProps) {
  // ── Monaco keybinding ref ─────────────────────────────────────────────────
  // onMount fires once; keep a ref so the callback always sees current values.
  const latestRef = useRef({ onRun, isRunning });

  useEffect(() => {
    latestRef.current = { onRun, isRunning };
  }, [onRun, isRunning]);

  // ── "Ask in Plain English" state ──────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEditorChange(val: string | undefined) {
    onChange(val ?? '');
  }

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        const { onRun: run, isRunning: running } = latestRef.current;
        if (!running) run();
      },
    );
  };

  async function handleAskAi() {
    const prompt = aiPrompt.trim();
    if (!prompt || isAskingAi) return;

    setAiError(null);
    try {
      const generatedSql = await onAskAi(prompt);
      onChange(generatedSql);   // Insert SQL into editor — do NOT auto-run
      setAiPrompt('');          // Clear the natural-language prompt
    } catch (err: unknown) {
      // Parent already formats a user-friendly message; display whatever was thrown.
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'AI generation failed.';
      setAiError(msg);
    }
  }

  function handleAiInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAskAi();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* ── Ask-in-plain-English bar ── */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => {
              setAiPrompt(e.target.value);
              if (aiError) setAiError(null); // Clear error on new input
            }}
            onKeyDown={handleAiInputKeyDown}
            disabled={isAskingAi}
            placeholder="Ask in plain English, e.g. 'show top 10 customers by revenue'"
            className="flex-1 rounded border border-steel bg-ink px-3 py-1.5 text-sm text-slate-200 placeholder-fog/60 outline-none transition-colors focus:border-signal disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={handleAskAi}
            disabled={isAskingAi || aiPrompt.trim().length === 0}
            className="flex items-center gap-1.5 rounded bg-steel px-3 py-1.5 text-sm font-medium text-slate-200 transition-opacity hover:opacity-70 active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Generate SQL from plain English"
          >
            {isAskingAi ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                Generating…
              </>
            ) : (
              <>✨ Generate SQL</>
            )}
          </button>
        </div>

        {/* Inline AI error */}
        {aiError && (
          <p className="text-xs text-alert">{aiError}</p>
        )}
      </div>

      {/* ── Monaco editor ── */}
      <div className="overflow-hidden rounded border border-steel">
        <Editor
          height="200px"
          language="sql"
          theme="vs-dark"
          value={value}
          onChange={handleEditorChange}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'line',
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* ── Run toolbar ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded bg-pulse px-4 py-1.5 text-sm font-medium text-void transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-void border-t-transparent" />
              Running…
            </>
          ) : (
            <>▶ Run Query</>
          )}
        </button>

        <span className="text-xs text-fog/60">
          Ctrl+Enter to run
        </span>
      </div>
    </div>
  );
}
