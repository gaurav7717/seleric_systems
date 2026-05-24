"use client"

import type { SimResult } from "@/lib/cogs-engine"
import { MetricTile } from "./MetricTile"

const fmt = (n: number) =>
  `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}${n < 0 ? " (−)" : ""}`

const fmtSigned = (n: number) => {
  const abs = `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`
  return n < 0 ? `-${abs}` : abs
}

function BlockTitle({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
      {children}
    </p>
  )
}

export function UnitEconomicsGrid({
  result,
  targetProfit,
}: {
  result: SimResult
  targetProfit: number
}) {
  const {
    netRev,
    contribution,
    cmPercent,
    netProfit,
    roas,
    beVendorCost,
    targetVendorCost,
    requiredReductionPct,
    currentCostGapPct,
    ordersRequired,
    adSpendRequired,
    expectedRevenue,
  } = result

  const alreadyAtTarget =
    targetVendorCost >= result.netRev - result.totalVarCost || requiredReductionPct <= 0

  const scaleLabel =
    targetProfit > 0
      ? `Scale to ₹${Math.round(targetProfit).toLocaleString("en-IN")} profit`
      : "Scale to target profit"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-insight-border bg-white p-3.5 shadow-sm">
      <BlockTitle>Unit economics</BlockTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="Net revenue / unit" value={fmt(netRev)} compact highlight />
        <MetricTile
          label="Contribution / unit"
          value={fmtSigned(contribution)}
          negative={contribution < 0}
          compact
          highlight={contribution > 0}
        />
        <MetricTile
          label="Net profit / unit"
          value={fmtSigned(netProfit)}
          sub={`CM ${cmPercent.toFixed(1)}%`}
          negative={netProfit < 0}
          compact
          highlight={netProfit > 0}
        />
        <MetricTile label="ROAS" value={`${roas.toFixed(2)}x`} compact />
      </div>

      <div className="border-t border-stone-200 pt-3">
        <BlockTitle>Break-even &amp; target cost</BlockTitle>
        <div className="grid grid-cols-3 gap-2">
          <MetricTile
            label="Break-even vendor"
            value={fmtSigned(beVendorCost)}
            negative={beVendorCost < 0}
            compact
          />
          <MetricTile
            label="Target vendor"
            value={fmtSigned(targetVendorCost)}
            negative={targetVendorCost < 0}
            compact
          />
          <MetricTile
            label="Required reduction"
            value={alreadyAtTarget ? "0.0%" : `${requiredReductionPct.toFixed(1)}%`}
            negative={requiredReductionPct > 30}
            compact
            highlight={alreadyAtTarget}
          />
        </div>
        <div className="mt-2.5">
          <div className="mb-1 flex justify-between text-[10px] text-stone-500">
            <span>Cost gap</span>
            <span>
              {alreadyAtTarget
                ? "Below target"
                : `${requiredReductionPct.toFixed(1)}% reduction needed`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all ${
                alreadyAtTarget
                  ? "bg-insight-positive"
                  : requiredReductionPct > 30
                    ? "bg-insight-negative"
                    : "bg-amber-500"
              }`}
              style={{
                width: `${Math.min(100, alreadyAtTarget ? 100 : currentCostGapPct)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {ordersRequired !== null && (
        <div className="border-t border-stone-200 pt-3">
          <BlockTitle>{scaleLabel}</BlockTitle>
          <div className="grid grid-cols-3 gap-2">
            <MetricTile
              label="Orders required"
              value={ordersRequired.toLocaleString("en-IN")}
              compact
            />
            <MetricTile label="Ad spend required" value={fmt(adSpendRequired!)} compact />
            <MetricTile label="Expected revenue" value={fmt(expectedRevenue!)} compact />
          </div>
        </div>
      )}
    </div>
  )
}
