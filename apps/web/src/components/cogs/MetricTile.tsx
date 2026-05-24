"use client"

interface MetricTileProps {
  label: string
  value: string
  sub?: string
  negative?: boolean
  highlight?: boolean
  compact?: boolean
}

export function MetricTile({
  label,
  value,
  sub,
  negative,
  highlight,
  compact,
}: MetricTileProps) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-lg border border-insight-border bg-stone-50 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
    >
      <span className="truncate text-[10px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </span>
      <span
        className={`truncate font-semibold tabular-nums leading-tight ${
          compact ? "text-sm" : "text-base"
        } ${
          negative
            ? "text-insight-negative"
            : highlight
              ? "text-insight-positive"
              : "text-stone-900"
        }`}
      >
        {value}
      </span>
      {sub && <span className="truncate text-[10px] text-stone-500">{sub}</span>}
    </div>
  )
}
