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
    <div className="rounded-lg border border-pulse/40 bg-pulse/10 p-5">
      {/* Headline */}
      <div className="mb-4 text-center">
        <span className="font-mono text-5xl font-black tabular-nums text-pulse">
          {pct}%
        </span>
        <span className="ml-2 text-lg font-medium text-pulse/80">faster</span>
        <p className="mt-1 text-xs text-fog">after applying the suggested index</p>
      </div>

      {/* Before → After timing row */}
      <div className="flex items-center justify-center gap-4">
        {/* Before */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fog">
            Before
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums text-slate-200">
            {before}
            <span className="ml-0.5 text-sm font-normal text-fog">ms</span>
          </span>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <span className="text-xl text-pulse/60">→</span>
        </div>

        {/* After */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fog">
            After
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums text-pulse">
            {after}
            <span className="ml-0.5 text-sm font-normal text-fog">ms</span>
          </span>
        </div>
      </div>
    </div>
  );
}
