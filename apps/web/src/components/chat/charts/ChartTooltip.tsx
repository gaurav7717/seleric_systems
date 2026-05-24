"use client"

export function LightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-night-900 border border-stone-200 dark:border-night-800 rounded-lg px-3 py-2 text-xs shadow-lg dark:shadow-none font-serif">
      <p className="text-stone-500 dark:text-night-500 mb-1 font-sans font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}
        </p>
      ))}
    </div>
  )
}
