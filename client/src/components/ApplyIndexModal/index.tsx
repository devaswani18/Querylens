// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApplyIndexModalProps {
  statement: string | null;  // null = modal is closed
  isApplying: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// ApplyIndexModal
// ---------------------------------------------------------------------------

/**
 * Modal for confirming a CREATE INDEX statement.
 *
 * Controlled purely via props — the parent decides whether it's open by
 * setting `statement` to a non-null string or null.
 * - onConfirm: parent calls the API and sets isApplying / error accordingly.
 * - onCancel: parent clears the statement (closes the modal).
 * - Backdrop click calls onCancel unless isApplying is true.
 */
export default function ApplyIndexModal({
  statement,
  isApplying,
  error,
  onConfirm,
  onCancel,
}: ApplyIndexModalProps) {
  // Parent controls visibility via the statement prop
  if (statement === null) return null;

  function handleBackdropClick() {
    if (!isApplying) onCancel();
  }

  function handleDialogClick(e: React.MouseEvent) {
    // Stop backdrop handler from firing when clicking inside the dialog
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg border border-steel bg-ink shadow-2xl"
        onClick={handleDialogClick}
      >
        {/* Header */}
        <div className="border-b border-steel px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">
            Apply Suggested Index
          </h2>
          <p className="mt-0.5 text-xs text-fog">
            This will create an index on your database. Review the statement
            below before confirming.
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Statement */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fog">
            Statement
          </p>
          <pre className="overflow-x-auto rounded border border-steel bg-void px-4 py-3 font-mono text-sm text-pulse">
            {statement}
          </pre>

          {/* Error */}
          {error && (
            <div className="mt-3 rounded border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-steel px-5 py-4">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="rounded border border-steel px-4 py-1.5 text-sm text-fog transition-colors hover:border-fog/40 hover:bg-steel/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isApplying}
            className="flex items-center gap-2 rounded bg-signal px-4 py-1.5 text-sm font-medium text-void transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-void border-t-transparent" />
                Applying…
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
