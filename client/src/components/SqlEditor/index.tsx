import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SqlEditor({
  value,
  onChange,
  onRun,
  isRunning,
}: SqlEditorProps) {
  // Keep a ref with the latest values of onRun and isRunning so that the
  // addCommand callback (registered once in onMount) never sees a stale
  // closure — onMount only fires once, but props change on every render.
  const latestRef = useRef({ onRun, isRunning });

  useEffect(() => {
    latestRef.current = { onRun, isRunning };
  }, [onRun, isRunning]);

  function handleEditorChange(val: string | undefined) {
    onChange(val ?? '');
  }

  const handleMount: OnMount = (editor, monaco) => {
    // Register Ctrl+Enter / Cmd+Enter directly with Monaco's command API.
    // This fires before Monaco's built-in newline handler, so we get clean
    // keybinding interception without the wrapper-div approach.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        const { onRun: run, isRunning: running } = latestRef.current;
        if (!running) run();
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Monaco editor */}
      <div className="overflow-hidden rounded border border-slate-700">
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

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running…
            </>
          ) : (
            <>▶ Run Query</>
          )}
        </button>

        <span className="text-xs text-slate-600">
          Ctrl+Enter to run
        </span>
      </div>
    </div>
  );
}
