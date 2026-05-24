"use client"

interface SimSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  prefix?: string
  suffix?: string
  onChange: (v: number) => void
}

function formatValue(value: number, suffix?: string) {
  const decimals = suffix === "%" ? 1 : 0
  return value.toLocaleString("en-IN", { maximumFractionDigits: decimals })
}

export function SimSlider({
  label,
  value,
  min,
  max,
  step,
  prefix = "",
  suffix = "",
  onChange,
}: SimSliderProps) {
  const range = max - min
  const pct = range > 0 ? Math.min(100, Math.max(0, ((value - min) / range) * 100)) : 0

  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] leading-tight text-stone-500">{label}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-900">
          {prefix}
          {formatValue(value, suffix)}
          {suffix}
        </span>
      </div>
      <div className="relative flex h-5 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, rgb(46 125 50) 0%, rgb(46 125 50) ${pct}%, rgb(231 229 228) ${pct}%, rgb(231 229 228) 100%)`,
          }}
          className="sim-range h-1 w-full cursor-pointer appearance-none rounded-full outline-none transition-opacity group-hover:opacity-100"
          aria-label={label}
        />
      </div>
    </div>
  )
}
