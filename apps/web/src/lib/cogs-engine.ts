export interface SimInputs {
  asp: number
  cogs: number
  cogsShipping: number
  packaging: number
  cac: number
  ship: number
  rtoPercent: number
  pgwPercent: number
  gstInclusive: boolean
  taxRate: number
  targetMarginPercent: number
  targetAbsoluteProfit: number
}

export type Classification = "WINNER" | "BORDERLINE" | "LOSER"

export interface ScenarioRow {
  vendorCost: number
  profit: number
  marginPct: number
  badge: Classification
}

export interface SimResult {
  productCost: number
  netRev: number
  pgwCost: number
  rtoCost: number
  totalVarCost: number
  contribution: number
  cmPercent: number
  netProfit: number
  roas: number
  beVendorCost: number
  targetVendorCost: number
  requiredReductionPct: number
  currentCostGapPct: number
  classification: Classification
  recommendation: string
  ordersRequired: number | null
  adSpendRequired: number | null
  expectedRevenue: number | null
  scenarios: ScenarioRow[]
}

function classifyRow(netProfit: number, cmPercent: number): Classification {
  if (netProfit > 0) return "WINNER"
  if (cmPercent > 0) return "BORDERLINE"
  return "LOSER"
}

function buildRecommendation(
  classification: Classification,
  cac: number,
  targetVendorCost: number,
): string {
  if (classification === "WINNER") {
    return "Unit economics are healthy. Scale ad spend to maximise absolute profit."
  }
  if (classification === "BORDERLINE") {
    const cacTarget = Math.round(cac * 0.65)
    const cogsTarget = Math.max(0, Math.round(targetVendorCost))
    return cogsTarget > 0
      ? `Contribution positive but ad cost kills margin. Cut CAC below ₹${cacTarget} or renegotiate COGS below ₹${cogsTarget}. Both levers together recommended.`
      : `Contribution positive but ad cost kills margin. Cut CAC below ₹${cacTarget}. Vendor renegotiation alone cannot save this SKU.`
  }
  return "Contribution margin negative. COGS reduction alone cannot rescue this SKU. Revisit pricing or discontinue."
}

function buildScenarios(
  inputs: SimInputs,
  netRev: number,
  totalVarCost: number,
): ScenarioRow[] {
  // cogs = product cost only; shipping + packaging are fixed components of effective COGS
  const { cogs, cogsShipping, packaging, targetMarginPercent } = inputs
  const fixedCogsComponents = cogsShipping + packaging
  const deltas = [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2]
  return deltas.map((d) => {
    const vc = Math.round(cogs * (1 + d))
    const effectiveCogs = vc + fixedCogsComponents
    const profit = netRev - effectiveCogs - totalVarCost
    const marginPct = netRev > 0 ? (profit / netRev) * 100 : 0
    const badge: Classification =
      profit > 0 && marginPct >= targetMarginPercent
        ? "WINNER"
        : profit > 0 || marginPct > 0
          ? "BORDERLINE"
          : "LOSER"
    return { vendorCost: vc, profit: Math.round(profit * 100) / 100, marginPct: Math.round(marginPct * 10) / 10, badge }
  })
}

export function simulate(inputs: SimInputs): SimResult {
  const { asp, cogs, cogsShipping, packaging, cac, ship, rtoPercent, pgwPercent, gstInclusive, taxRate, targetMarginPercent, targetAbsoluteProfit } = inputs

  const netRev = gstInclusive ? asp / (1 + taxRate / 100) : asp

  const pgwCost = netRev * (pgwPercent / 100)
  const rtoCost = netRev * (rtoPercent / 100)
  const totalVarCost = cac + ship + pgwCost + rtoCost

  // cogs = actual product cost; effectiveCogs = cogs + fixed shipping + packaging
  const fixedCogsComponents = cogsShipping + packaging
  const effectiveCogs = cogs + fixedCogsComponents

  const contribution = netRev - effectiveCogs
  const cmPercent = netRev > 0 ? (contribution / netRev) * 100 : 0
  const netProfit = netRev - effectiveCogs - totalVarCost
  const roas = cac > 0 ? asp / cac : 0

  // break-even and target expressed in product cost terms (shipping + packaging stay fixed)
  const beVendorCost = netRev - totalVarCost - fixedCogsComponents
  const targetVendorCost = netRev * (1 - targetMarginPercent / 100) - totalVarCost - fixedCogsComponents
  const requiredReductionPct = cogs > 0 && targetVendorCost < cogs
    ? ((cogs - targetVendorCost) / cogs) * 100
    : 0
  // when targetVendorCost ≤ 0 the gap cannot be closed by vendor negotiation alone → 100%
  const currentCostGapPct = targetVendorCost > 0
    ? Math.min(100, Math.max(0, (cogs / targetVendorCost) * 100))
    : 100

  const classification = classifyRow(netProfit, cmPercent)
  const recommendation = buildRecommendation(classification, cac, targetVendorCost)

  const ordersRequired = netProfit > 0 ? Math.ceil(targetAbsoluteProfit / netProfit) : null
  const adSpendRequired = ordersRequired !== null ? ordersRequired * cac : null
  const expectedRevenue = ordersRequired !== null ? ordersRequired * asp : null

  return {
    productCost: cogs, netRev, pgwCost, rtoCost, totalVarCost,
    contribution, cmPercent, netProfit, roas,
    beVendorCost, targetVendorCost, requiredReductionPct, currentCostGapPct,
    classification, recommendation,
    ordersRequired, adSpendRequired, expectedRevenue,
    scenarios: buildScenarios(inputs, netRev, totalVarCost),
  }
}

export const DEFAULT_INPUTS: SimInputs = {
  asp: 999,
  cogs: 223,  // product cost only (effective COGS 350 − shipping 117 − packaging 10)
  cogsShipping: 117,
  packaging: 10,
  cac: 500,
  ship: 0,  // additional outbound cost beyond what's already in cogsShipping (default: none)
  rtoPercent: 12,
  pgwPercent: 2,
  gstInclusive: true,
  taxRate: 18,
  targetMarginPercent: 10,
  targetAbsoluteProfit: 80000,
}
