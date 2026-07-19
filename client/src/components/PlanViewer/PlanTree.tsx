// ---------------------------------------------------------------------------
// PlanTree — visual tree renderer for a Postgres EXPLAIN plan
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types — Postgres EXPLAIN JSON node shape (partial, only fields we use)
// ---------------------------------------------------------------------------

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  Plans?: PlanNode[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NodeClass = 'scan-warning' | 'scan-good' | 'neutral';

const SEQ_SCAN_TYPES = new Set(['Seq Scan', 'Parallel Seq Scan']);
const INDEX_SCAN_TYPES = new Set([
  'Index Scan',
  'Index Only Scan',
  'Bitmap Index Scan',
  'Bitmap Heap Scan',
]);

function classifyNode(nodeType: string): NodeClass {
  if (SEQ_SCAN_TYPES.has(nodeType)) return 'scan-warning';
  if (INDEX_SCAN_TYPES.has(nodeType)) return 'scan-good';
  return 'neutral';
}

const CLASS_STYLES: Record<NodeClass, { border: string; bg: string; label: string }> = {
  'scan-warning': { border: 'border-alert/50', bg: 'bg-alert/10',  label: 'text-alert' },
  'scan-good':    { border: 'border-pulse/50', bg: 'bg-pulse/10',  label: 'text-pulse' },
  neutral:        { border: 'border-steel',    bg: 'bg-ink',       label: 'text-fog'   },
};

// ---------------------------------------------------------------------------
// NodeCard — single plan node box
// ---------------------------------------------------------------------------

function NodeCard({ node }: { node: PlanNode }) {
  const nodeType = node['Node Type'];
  const cls = classifyNode(nodeType);
  const { border, bg, label } = CLASS_STYLES[cls];

  const title = node['Relation Name']
    ? `${nodeType} (${node['Relation Name']})`
    : nodeType;

  const rows   = node['Actual Rows'];
  const timeMs = node['Actual Total Time'];

  return (
    <div className={`w-44 shrink-0 rounded border px-3 py-2 font-mono text-xs ${border} ${bg}`}>
      <p className={`font-semibold leading-tight ${label}`}>{title}</p>

      {(rows !== undefined || timeMs !== undefined) && (
        <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-fog">
          {rows !== undefined && (
            <span>
              <span className="text-slate-200">{rows.toLocaleString()}</span> rows
            </span>
          )}
          {timeMs !== undefined && (
            <span>
              <span className="text-slate-200">{timeMs.toFixed(2)}</span> ms
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiChildConnector — crossbar connector for 2+ children
//
// Each child column independently draws only the horizontal segment it
// is responsible for, so they join into one continuous crossbar regardless
// of how wide each child's subtree turns out to be:
//
//   first child  → right half of column only  (─┐ shape)
//   middle child → full width of column        (─┬─ shape)
//   last child   → left half of column only   (┌─ shape)
//
// No absolute positioning or hardcoded pixel widths needed.
// ---------------------------------------------------------------------------

function MultiChildConnector({ children: childNodes }: { children: PlanNode[] }) {
  const last = childNodes.length - 1;

  return (
    <div className="flex flex-col items-center">
      {/* Vertical stem from parent card bottom to the crossbar row */}
      <div className="w-px bg-steel" style={{ height: 12 }} />

      {/* Crossbar row */}
      <div className="flex items-start">
        {childNodes.map((child, i) => {
          const isFirst  = i === 0;
          const isLast   = i === last;

          // Which halves of this column carry the horizontal bar
          const leftBar  = !isFirst;  // connect left  to previous sibling
          const rightBar = !isLast;   // connect right to next     sibling

          return (
            // No horizontal padding here — the line row must span the full
            // column width so adjacent segments meet with no gap.
            <div key={i} className="flex flex-col items-center">
              {/* Horizontal crossbar segment for this column */}
              <div className="flex w-full" style={{ height: 12 }}>
                {/* Left half */}
                <div
                  className={`flex-1 ${leftBar ? 'border-t border-steel' : ''}`}
                  style={{ marginTop: 11 }}
                />
                {/* Center drop (always present) — 1px wide */}
                <div className="w-px bg-steel h-full" />
                {/* Right half */}
                <div
                  className={`flex-1 ${rightBar ? 'border-t border-steel' : ''}`}
                  style={{ marginTop: 11 }}
                />
              </div>

              {/* px-4 spacing lives here, around the subtree only — keeps
                  sibling cards visually separated without breaking the line */}
              <div className="px-4">
                <TreeNode node={child} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeNode — recursive: card + connector + children
// ---------------------------------------------------------------------------

function TreeNode({ node }: { node: PlanNode }) {
  const children: PlanNode[] = Array.isArray(node.Plans) ? node.Plans : [];

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} />

      {children.length === 1 && (
        <>
          {/* Straight vertical line for a single child */}
          <div className="w-px bg-steel" style={{ height: 12 }} />
          <TreeNode node={children[0]} />
        </>
      )}

      {children.length > 1 && (
        <MultiChildConnector>{children}</MultiChildConnector>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlanTree — public root component
// ---------------------------------------------------------------------------

interface PlanTreeProps {
  plan: object;
}

export default function PlanTree({ plan }: PlanTreeProps) {
  return (
    <div className="overflow-x-auto rounded border border-steel bg-void px-6 py-5">
      <div className="inline-flex flex-col items-center min-w-max">
        <TreeNode node={plan as PlanNode} />
      </div>
    </div>
  );
}
