// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComparisonCardProps {
  beforeMs: number;
  afterMs: number;
  percentFaster: number;
}

// ---------------------------------------------------------------------------
// ComparisonCard
//
// The "wow moment" after applying a suggested index — shows the before/after
// query timing with the improvement percentage as the headline number.
// Pure display component: no state, no API calls.
// ---------------------------------------------------------------------------

export default function ComparisonCard({
  beforeMs,
  afterMs,
  percentFaster,
}: ComparisonCardProps) {
  const before = Math.round(beforeMs);
  const after = Math.round(afterMs);
  const pct = Math.round(percentFaster);

  return (
    <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 p-5">
      {/* Headline */}
      <div className="mb-4 text-center">
        <span className="text-4xl font-bold tabular-nums text-emerald-400">
          {pct}%
        </span>
        <span className="ml-2 text-lg font-medium text-emerald-300">faster</span>
        <p className="mt-1 text-xs text-slate-500">after applying the suggested index</p>
      </div>

      {/* Before → After timing row */}
      <div className="flex items-center justify-center gap-4">
        {/* Before */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Before
          </span>
          <span className="text-2xl font-bold tabular-nums text-slate-300">
            {before}
            <span className="ml-0.5 text-sm font-normal text-slate-500">ms</span>
          </span>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <span className="text-xl text-emerald-600">→</span>
        </div>

        {/* After */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            After
          </span>
          <span className="text-2xl font-bold tabular-nums text-emerald-300">
            {after}
            <span className="ml-0.5 text-sm font-normal text-slate-500">ms</span>
          </span>
        </div>
      </div>
    </div>
  );
}
