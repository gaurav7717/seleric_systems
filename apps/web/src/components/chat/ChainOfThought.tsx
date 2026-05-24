"use client"

import { useState } from "react"
import type { CotStep } from "@/lib/chat/partition-message"

function StepRow({ step }: { step: CotStep }) {
  const [open, setOpen] = useState(step.state === "running")

  const headerLabel =
    step.toolName === "exploreSchema" && step.label.startsWith("Used")
      ? step.label
      : `${step.label || "Working"}${step.detail ? ` — ${step.detail}` : ""}`

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-left w-full group"
      >
        <span className="text-xs text-stone-400 font-sans">
          {step.state === "running" && (
            <span className="inline-block w-3 h-3 mr-1 border-2 border-stone-400 border-t-transparent rounded-full animate-spin align-middle" />
          )}
          <span className="text-stone-500 hover:text-stone-700">{headerLabel}</span>
          <span className="text-stone-400 ml-0.5">{open ? "∨" : "›"}</span>
        </span>
      </button>
      {(open || step.state === "running") && (
        <p className="text-sm text-stone-700 font-serif mt-0.5 pl-1 leading-relaxed">
          {step.state === "error" ? (
            <span className="text-insight-negative">{step.errorText ?? "Failed"}</span>
          ) : (
            step.narration
          )}
        </p>
      )}
    </div>
  )
}

export function ChainOfThought({
  steps,
  isActive = false,
}: {
  steps: CotStep[]
  isActive?: boolean
}) {
  if (!steps.length) return null

  const runningCount = steps.filter((s) => s.state === "running").length

  return (
    <div className="mb-3 space-y-0.5">
      {isActive && runningCount > 0 && (
        <p className="text-xs text-stone-400 font-sans mb-1 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          Running {runningCount} step{runningCount !== 1 ? "s" : ""}…
        </p>
      )}
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  )
}
