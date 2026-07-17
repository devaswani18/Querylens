// ---------------------------------------------------------------------------
// Rule Engine — deterministic plan analysis
// Pure logic only. No AI/LLM calls. No side effects.
// ---------------------------------------------------------------------------

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeqScanIssue {
  type: 'SEQ_SCAN';
  table: string;
  rows: number;
  costEstimate: number;
  actualTimeMs: number;
}

export interface InefficientJoinIssue {
  type: 'INEFFICIENT_JOIN';
  table: string;
  rows: number;
  costEstimate: number;
  actualTimeMs: number;
}

export interface DiskSortIssue {
  type: 'DISK_SORT';
  costEstimate: number;
  actualTimeMs: number;
}

export type Issue = SeqScanIssue | InefficientJoinIssue | DiskSortIssue;

export interface SuggestedIndex {
  table: string;
  column: string;
  statement: string;
}

export interface RuleEngineFindings {
  issues: Issue[];
  suggestedIndexes: SuggestedIndex[];
}

// ── Plan node shape (partial — only the fields we read) ─────────────────────

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Actual Rows'?: number;
  'Total Cost'?: number;
  'Actual Total Time'?: number;
  'Sort Method'?: string;
  Filter?: string;
  Plans?: PlanNode[];
}

// ── Thresholds ───────────────────────────────────────────────────────────────

const SEQ_SCAN_ROW_THRESHOLD = 1000;   // rows
const SEQ_SCAN_TIME_THRESHOLD = 50;    // ms

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Walks the EXPLAIN JSON plan tree and returns structured findings.
 *
 * @param rawPlan - The top-level plan object returned by explain.service.ts
 *                  (i.e. rawPlan["Plan"] is the root node).
 */
export function analyzePlan(rawPlan: object): RuleEngineFindings {
  const issues: Issue[] = [];
  const suggestedIndexes: SuggestedIndex[] = [];
  // Deduplicate index suggestions (same table + column shouldn't appear twice)
  const indexSeen = new Set<string>();

  const planObj = rawPlan as { Plan?: PlanNode };
  const rootNode = planObj['Plan'];
  if (!rootNode) {
    return { issues, suggestedIndexes };
  }

  walkNode(rootNode, null, issues, suggestedIndexes, indexSeen);

  return { issues, suggestedIndexes };
}

// ── Tree walker ──────────────────────────────────────────────────────────────

function walkNode(
  node: PlanNode,
  parentNode: PlanNode | null,
  issues: Issue[],
  suggestedIndexes: SuggestedIndex[],
  indexSeen: Set<string>,
): void {
  const nodeType = node['Node Type'] ?? '';
  const actualRows = node['Actual Rows'] ?? 0;
  const totalCost = node['Total Cost'] ?? 0;
  const actualTimeMs = node['Actual Total Time'] ?? 0;

  // ── Rule 1: Seq Scan (or Parallel Seq Scan) on a filtered/large/slow table
  const isSeqScan = nodeType === 'Seq Scan' || nodeType === 'Parallel Seq Scan';
  if (
    isSeqScan &&
    (
      (node.Filter !== undefined && node.Filter !== '') ||
      actualRows > SEQ_SCAN_ROW_THRESHOLD ||
      actualTimeMs > SEQ_SCAN_TIME_THRESHOLD
    )
  ) {
    const table = node['Relation Name'] ?? 'unknown';

    issues.push({
      type: 'SEQ_SCAN',
      table,
      rows: actualRows,
      costEstimate: totalCost,
      actualTimeMs,
    });

    // Suggest an index if there's a Filter we can parse a column name from
    const filterColumn = parseFilterColumn(node.Filter);
    if (filterColumn && table !== 'unknown') {
      const key = `${table}.${filterColumn}`;
      if (!indexSeen.has(key)) {
        indexSeen.add(key);
        suggestedIndexes.push({
          table,
          column: filterColumn,
          statement: `CREATE INDEX idx_${table}_${filterColumn} ON ${table}(${filterColumn});`,
        });
      }
    }
  }

  // ── Rule 2: Nested Loop whose child is a costly Seq Scan ─────────────────
  if (nodeType.includes('Nested Loop') && node.Plans) {
    for (const child of node.Plans) {
      const childRows = child['Actual Rows'] ?? 0;
      const childType = child['Node Type'] ?? '';
      if (
        (childType === 'Seq Scan' || childType === 'Parallel Seq Scan') &&
        childRows > SEQ_SCAN_ROW_THRESHOLD
      ) {
        const table = child['Relation Name'] ?? 'unknown';
        issues.push({
          type: 'INEFFICIENT_JOIN',
          table,
          rows: childRows,
          costEstimate: child['Total Cost'] ?? 0,
          actualTimeMs: child['Actual Total Time'] ?? 0,
        });
      }
    }
  }

  // ── Rule 3: Sort with external (disk) spill ──────────────────────────────
  if (nodeType === 'Sort') {
    const sortMethod = (node['Sort Method'] ?? '').toLowerCase();
    if (sortMethod.includes('external')) {
      issues.push({
        type: 'DISK_SORT',
        costEstimate: totalCost,
        actualTimeMs,
      });
    }
  }

  // ── Recurse into child nodes ─────────────────────────────────────────────
  if (node.Plans) {
    for (const child of node.Plans) {
      walkNode(child, node, issues, suggestedIndexes, indexSeen);
    }
  }
}

// ── Filter parser ────────────────────────────────────────────────────────────

/**
 * Extracts the column name from a simple Filter expression such as:
 *   "(customer_id = $1)"
 *   "(status = 'pending')"
 *   "(email = 'foo@bar.com')"
 *
 * Returns null if the filter is too complex to parse safely.
 * This is intentionally conservative — we only suggest an index when we're
 * confident about the column name.
 */
function parseFilterColumn(filter: string | undefined): string | null {
  if (!filter) return null;

  // Match: optional leading "(" then a plain identifier then " = "
  // The identifier must consist only of word characters (no dots, no casts).
  const match = filter.match(/^\(?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  return match ? match[1] : null;
}
