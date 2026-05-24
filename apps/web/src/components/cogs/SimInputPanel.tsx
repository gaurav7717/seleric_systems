"use client"

import type { SimInputs } from "@/lib/cogs-engine"
import { SimSlider } from "./SimSlider"

interface Props {
  inputs: SimInputs
  onChange: (patch: Partial<SimInputs>) => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
      {children}
    </h3>
  )
}

export function SimInputPanel({ inputs, onChange }: Props) {
  const maxCogs = Math.max(2000, inputs.asp)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-insight-border bg-white p-3.5 shadow-sm">
      <SectionLabel>Assumptions</SectionLabel>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
        <SimSlider
          label="Vendor cost per unit (₹)"
          value={inputs.cogs}
          min={0}
          max={maxCogs}
          step={10}
          prefix="₹"
          onChange={(v) => onChange({ cogs: v })}
        />
        <SimSlider
          label="CAC — cost per order (₹)"
          value={inputs.cac}
          min={0}
          max={3000}
          step={10}
          prefix="₹"
          onChange={(v) => onChange({ cac: v })}
        />
        <SimSlider
          label="Shipping per unit (₹)"
          value={inputs.ship}
          min={0}
          max={500}
          step={5}
          prefix="₹"
          onChange={(v) => onChange({ ship: v })}
        />
        <SimSlider
          label="RTO / return provision (%)"
          value={inputs.rtoPercent}
          min={0}
          max={50}
          step={0.5}
          suffix="%"
          onChange={(v) => onChange({ rtoPercent: v })}
        />
        <SimSlider
          label="Payment gateway fee (%)"
          value={inputs.pgwPercent}
          min={0}
          max={5}
          step={0.1}
          suffix="%"
          onChange={(v) => onChange({ pgwPercent: v })}
        />
        <SimSlider
          label="Target profit margin (%)"
          value={inputs.targetMarginPercent}
          min={0}
          max={60}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ targetMarginPercent: v })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200 pt-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-stone-700">
          <button
            type="button"
            role="switch"
            aria-checked={inputs.gstInclusive}
            onClick={() => onChange({ gstInclusive: !inputs.gstInclusive })}
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              inputs.gstInclusive ? "bg-insight-positive" : "bg-stone-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                inputs.gstInclusive ? "translate-x-3" : ""
              }`}
            />
          </button>
          GST inclusive price
        </label>
        {inputs.gstInclusive && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            <span>Tax</span>
            <select
              value={inputs.taxRate}
              onChange={(e) => onChange({ taxRate: Number(e.target.value) })}
              className="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs text-stone-900 focus:border-insight-positive focus:outline-none"
            >
              {[0, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <SectionLabel>Target scale</SectionLabel>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
        <SimSlider
          label="Target absolute profit (₹)"
          value={inputs.targetAbsoluteProfit}
          min={0}
          max={500000}
          step={1000}
          prefix="₹"
          onChange={(v) => onChange({ targetAbsoluteProfit: v })}
        />
        <SimSlider
          label="ASP — selling price (₹)"
          value={inputs.asp}
          min={100}
          max={10000}
          step={10}
          prefix="₹"
          onChange={(v) => onChange({ asp: v })}
        />
      </div>
    </div>
  )
}
