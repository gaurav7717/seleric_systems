import Link from "next/link"

const TOOLS = [
  {
    href: "/tools/cogs-simulation",
    title: "COGS Simulation",
    description: "Model unit economics per SKU — break-even, target vendor cost, scale targets. Pulls real COGS and CAC from Cube data.",
    badge: "Finance",
  },
]

export default function ToolsPage() {
  return (
    <main className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Tools</h1>
      <p className="text-sm text-stone-500 mb-8">Standalone calculators and simulators powered by your live data.</p>
      <div className="grid gap-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-xl border border-insight-border bg-white p-5 shadow-sm hover:border-insight-positive transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-semibold text-stone-900 group-hover:text-insight-positive transition-colors">
                  {tool.title}
                </span>
                <p className="text-sm text-stone-500 mt-1">{tool.description}</p>
              </div>
              <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                {tool.badge}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
