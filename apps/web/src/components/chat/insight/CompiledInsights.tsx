"use client"

import { generateCompiledInsights } from "@/lib/chat/visualization/generate-compiled-insights"
import type { MergedToolData } from "@/lib/chat/merge-tool-results"

export function CompiledInsights({ merged }: { merged: MergedToolData }) {
  const sections = generateCompiledInsights(merged)
  if (!sections.length) return null

  return (
    <div className="mt-4 pt-4 border-t border-insight-border">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 mb-3 font-sans">
        Insights from compiled data
      </h3>
      <div className="space-y-4 font-serif text-sm text-stone-800 leading-relaxed">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="font-sans font-semibold text-stone-900 text-xs mb-1.5">{section.title}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              {section.bullets.map((bullet, i) => (
                <li key={i}>
                  <InsightBullet text={bullet} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-stone-400 font-sans mt-3">
        Auto-generated from tool results. Est. LTV uses AOV × margin × 1.4 when cohort data is unavailable.
      </p>
    </div>
  )
}

function InsightBullet({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-stone-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
