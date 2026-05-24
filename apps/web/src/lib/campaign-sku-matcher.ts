export interface RawSkuRow {
  sku: string
  productTitle: string
  qty: number
  unitCost: number        // effective_unit_cost_avg
  asp: number | null      // avg_unit_price (GST-inclusive)
  grossRevenue: number    // gross_line_revenue
  netRevenueExGst: number // gross_line_revenue_ex_gst
}

export interface RawCampaignRow {
  campaignName: string
  spend: number
  purchases: number
}

/** Per-variant data with campaign spend allocated proportionally by qty share. */
export interface VariantData {
  sku: string
  qty: number
  qtyShare: number          // this variant's qty / product totalQty
  cogs: number              // variant-specific, date-effective from Cube
  asp: number | null        // variant-specific selling price
  grossRevenue: number
  netRevenueExGst: number
  allocatedAdSpend: number  // product adSpend × qtyShare
  allocatedPurchases: number
  cac: number               // allocatedAdSpend / allocatedPurchases
}

export interface ProductGroup {
  productBase: string      // "TH-198-UFOBALL"
  productTitle: string     // from highest-qty variant
  totalQty: number         // sum across variants
  avgCogs: number          // qty-weighted average COGS
  asp: number | null       // qty-weighted avg selling price
  grossRevenue: number     // total gross revenue (incl GST)
  netRevenueExGst: number  // total net revenue ex-GST
  variants: string[]       // all variant SKU codes
  variantData: VariantData[]
  // Filled after campaign matching:
  adSpend: number
  adPurchases: number
  cac: number
  matchedCampaigns: string[]
}

/**
 * Extracts the base product code from a SKU — strips size/colour/number suffix.
 *
 * "TH-198-UFOBALL-1"         → "TH-198-UFOBALL"
 * "TH-368-AVOCOOLMAT - L"    → "TH-368-AVOCOOLMAT"  (space stops match)
 * "TH-336-PAWTECH-GRAY"      → "TH-336-PAWTECH"
 * "TH-152-TANGLELEASH-BLACK" → "TH-152-TANGLELEASH"
 * "TH-285-FLIPPYFISHTOY"     → "TH-285-FLIPPYFISHTOY"
 */
const PRODUCT_BASE_RE = /^([A-Z]{2,3}-\d{2,5}-[A-Z]+)/i

export function extractProductBase(sku: string): string {
  const m = sku.match(PRODUCT_BASE_RE)
  return m ? m[1].toUpperCase() : sku.toUpperCase()
}

/** Groups variant-level SKU rows into product-level groups. */
export function groupSkusByProduct(skus: RawSkuRow[]): ProductGroup[] {
  const map = new Map<string, RawSkuRow[]>()
  for (const row of skus) {
    const base = extractProductBase(row.sku)
    map.set(base, [...(map.get(base) ?? []), row])
  }

  const groups: ProductGroup[] = []
  for (const [productBase, rows] of map) {
    const totalQty = rows.reduce((s, r) => s + r.qty, 0)

    const avgCogs =
      totalQty > 0
        ? rows.reduce((s, r) => s + r.unitCost * r.qty, 0) / totalQty
        : rows[0]?.unitCost ?? 0

    const aspNumerator = rows.reduce((s, r) => (r.asp !== null ? s + r.asp * r.qty : s), 0)
    const aspQty = rows.reduce((s, r) => (r.asp !== null ? s + r.qty : s), 0)
    const asp = aspQty > 0 ? aspNumerator / aspQty : null

    const grossRevenue = rows.reduce((s, r) => s + r.grossRevenue, 0)
    const netRevenueExGst = rows.reduce((s, r) => s + r.netRevenueExGst, 0)
    const dominantRow = rows.slice().sort((a, b) => b.qty - a.qty)[0]

    // variantData filled with zeros for ad allocation — populated after matching
    const variantData: VariantData[] = rows.map((r) => ({
      sku: r.sku,
      qty: r.qty,
      qtyShare: totalQty > 0 ? r.qty / totalQty : 0,
      cogs: r.unitCost,
      asp: r.asp,
      grossRevenue: r.grossRevenue,
      netRevenueExGst: r.netRevenueExGst,
      allocatedAdSpend: 0,
      allocatedPurchases: 0,
      cac: 0,
    }))

    groups.push({
      productBase,
      productTitle: dominantRow.productTitle,
      totalQty,
      avgCogs: Math.round(avgCogs * 100) / 100,
      asp,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      netRevenueExGst: Math.round(netRevenueExGst * 100) / 100,
      variants: rows.map((r) => r.sku),
      variantData,
      adSpend: 0,
      adPurchases: 0,
      cac: 0,
      matchedCampaigns: [],
    })
  }

  return groups.sort((a, b) => b.totalQty - a.totalQty)
}

const NUMERIC_PREFIX_RE = /\b([A-Z]{2,3}-\d{2,5})\b/i

function extractNumericPrefix(campaignName: string): string | null {
  const m = campaignName.match(NUMERIC_PREFIX_RE)
  return m ? m[1].toUpperCase() : null
}

/**
 * Matches campaigns to products and fills ad spend.
 * Variant-level CAC is allocated proportionally by qty share.
 */
export function matchCampaignsToProducts(
  products: ProductGroup[],
  campaigns: RawCampaignRow[],
): ProductGroup[] {
  const prefixMap = new Map<string, ProductGroup>()
  for (const product of products) {
    const m = product.productBase.match(/^([A-Z]{2,3}-\d{2,5})/i)
    if (m) prefixMap.set(m[1].toUpperCase(), product)
  }

  type Bucket = { spend: number; purchases: number; names: string[] }
  const buckets = new Map<string, Bucket>()

  for (const campaign of campaigns) {
    const prefix = extractNumericPrefix(campaign.campaignName)
    if (!prefix) continue
    const product = prefixMap.get(prefix)
    if (!product) continue

    const b = buckets.get(product.productBase) ?? { spend: 0, purchases: 0, names: [] }
    buckets.set(product.productBase, {
      spend: b.spend + campaign.spend,
      purchases: b.purchases + campaign.purchases,
      names: [...b.names, campaign.campaignName],
    })
  }

  return products.map((product) => {
    const b = buckets.get(product.productBase) ?? { spend: 0, purchases: 0, names: [] }
    const cac = b.purchases > 0 ? b.spend / b.purchases : 0

    // Allocate campaign spend to each variant by its qty share
    const variantData: VariantData[] = product.variantData.map((v) => {
      const allocatedAdSpend = Math.round(b.spend * v.qtyShare * 100) / 100
      const allocatedPurchases = Math.round(b.purchases * v.qtyShare)
      const variantCac = allocatedPurchases > 0 ? allocatedAdSpend / allocatedPurchases : cac
      return {
        ...v,
        allocatedAdSpend,
        allocatedPurchases,
        cac: Math.round(variantCac * 100) / 100,
      }
    })

    return {
      ...product,
      adSpend: Math.round(b.spend * 100) / 100,
      adPurchases: b.purchases,
      cac: Math.round(cac * 100) / 100,
      matchedCampaigns: b.names,
      variantData,
    }
  })
}
