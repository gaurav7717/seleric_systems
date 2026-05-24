interface Props {
  title: string
  subtitle?: string
  cube?: string
  children: React.ReactNode
  className?: string
}

export function ChartCard({ title, subtitle, cube, children, className = "" }: Props) {
  return (
    <section
      className={`rounded-xl border border-insight-border bg-white p-4 flex flex-col gap-3 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-stone-900 font-sans">{title}</h2>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
        {cube && (
          <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200">
            {cube}
          </span>
        )}
      </div>
      <div className="min-h-[180px] flex-1">{children}</div>
    </section>
  )
}
