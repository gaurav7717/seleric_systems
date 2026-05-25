# Unit economics — simulation engine reference

All formulas are deterministic. No ML, no stochastic models.
Every output is traceable to an input.

---

## 1. Inputs (per SKU, per period)

| Symbol | Name | Source | Notes |
|---|---|---|---|
| `ASP` | Average selling price (gross) | Orders data | Includes GST if tax-inclusive |
| `COGS` | Vendor / product cost per unit | `dim_sku_cost_version` | Point-in-time, never overwritten |
| `CAC` | Cost per acquired order | `Ad Spend / Orders` | 0 or null if ad_spend = 0 |
| `SHIP` | Shipping cost per unit | Config / cost sheet | Fixed or per-shipment |
| `PKG` | Packaging cost per unit | Config | Optional |
| `PGW%` | Payment gateway fee % | Config | Applied to net revenue |
| `RTO%` | Return / RTO provision % | Config | Applied to net revenue |
| `COD` | COD charge per unit | Config | 0 if not COD |
| `MKT%` | Marketplace fee % | Config | 0 for D2C |
| `TAX_RATE` | GST rate | Config | e.g. 0.18 for 18% |
| `GST_INCL` | Is ASP tax-inclusive? | Config flag | `true` / `false` |
| `TARGET_MARGIN%` | Desired net profit margin | Simulation input | e.g. 0.10 |
| `TARGET_PROFIT` | Desired absolute profit (₹) | Simulation input | e.g. ₹80,000 |

---

## 2. Derived price inputs

### Net revenue per unit

```
if GST_INCL = true:
    NET_REV = ASP / (1 + TAX_RATE)
else:
    NET_REV = ASP
```

> GST_INCL is a config flag. Default: true.
> If tax data is unavailable, set GST_INCL = false and NET_REV = ASP.

---

## 3. Variable cost stack (per unit)

Each cost is computed per unit before aggregation.

```
PGW_COST  = NET_REV × PGW%
RTO_COST  = NET_REV × RTO%
MKT_COST  = NET_REV × MKT%

TOTAL_VAR = CAC + SHIP + PKG + PGW_COST + RTO_COST + COD + MKT_COST
```

> `TOTAL_VAR` is the full variable cost stack excluding COGS.
> COGS is kept separate because it is the negotiation lever.

---

## 4. Core unit economics

### Contribution per unit

```
CONTRIBUTION = NET_REV - COGS
```

> Contribution covers COGS only. Does not include ad or logistics.

### Contribution margin %

```
CM% = CONTRIBUTION / NET_REV
```

### Net profit per unit

```
NET_PROFIT = NET_REV - COGS - TOTAL_VAR
```

### Net profit margin %

```
NPM% = NET_PROFIT / NET_REV
```

### ROAS

```
if CAC > 0:
    ROAS = ASP / CAC
else:
    ROAS = null   (organic / unattributed)
```

### Ad spend % of revenue

```
if ASP > 0:
    AD_SPEND_PCT = CAC / ASP
else:
    AD_SPEND_PCT = null
```

---

## 5. Break-even and target cost formulas

These are the core negotiation levers.

### Break-even vendor cost

The vendor cost at which net profit = 0.

```
BE_VENDOR_COST = NET_REV - TOTAL_VAR
```

> If current COGS > BE_VENDOR_COST, the SKU is loss-making at current cost.

### Target vendor cost (for desired margin)

The vendor cost required to achieve `TARGET_MARGIN%`.

```
TARGET_VENDOR_COST = NET_REV × (1 - TARGET_MARGIN%) - TOTAL_VAR
```

> Derivation:
>   NET_PROFIT = NET_REV - COGS - TOTAL_VAR
>   Set NET_PROFIT = NET_REV × TARGET_MARGIN%
>   → COGS = NET_REV - (NET_REV × TARGET_MARGIN%) - TOTAL_VAR
>   → COGS = NET_REV × (1 - TARGET_MARGIN%) - TOTAL_VAR

### Required COGS reduction (absolute)

```
REQUIRED_REDUCTION = COGS - TARGET_VENDOR_COST
```

> Positive = cost needs to come down.
> Negative = current cost already below target (no reduction needed).

### Required COGS reduction %

```
if COGS > 0:
    REQUIRED_REDUCTION_PCT = REQUIRED_REDUCTION / COGS
else:
    REQUIRED_REDUCTION_PCT = null
```

---

## 6. Scale planning formulas

Used to answer: "To hit ₹X profit, how many orders and how much ad spend do we need?"

### Orders required for target absolute profit

```
if NET_PROFIT > 0:
    ORDERS_REQUIRED = ceil(TARGET_PROFIT / NET_PROFIT)
else:
    ORDERS_REQUIRED = null   (unprofitable — cannot scale to profit at current cost)
```

### Ad spend required

```
AD_SPEND_REQUIRED = ORDERS_REQUIRED × CAC
```

### Expected revenue at scale

```
EXPECTED_REVENUE = ORDERS_REQUIRED × ASP
```

### Expected profit at scale

```
EXPECTED_PROFIT = ORDERS_REQUIRED × NET_PROFIT
```

> Expected profit will equal or slightly exceed TARGET_PROFIT due to ceil().

---

## 7. Aggregated period metrics

When rolling up from daily rows to WTD / MTD / seasonal:

```
TOTAL_REVENUE   = SUM(revenue_gross)
TOTAL_NET_REV   = SUM(revenue_net)
TOTAL_QTY       = SUM(quantity)
TOTAL_AD_SPEND  = SUM(ad_spend)
TOTAL_COGS      = SUM(cogs_per_unit × quantity)
TOTAL_SHIP      = SUM(shipping_total)
TOTAL_PKG       = SUM(packaging_total)
TOTAL_PGW       = SUM(gateway_fee_total)
TOTAL_RTO       = SUM(rto_cost_total)
TOTAL_VAR_AGG   = TOTAL_AD_SPEND + TOTAL_SHIP + TOTAL_PKG + TOTAL_PGW + TOTAL_RTO

CONTRIB_AGG     = TOTAL_NET_REV - TOTAL_COGS
CM%_AGG         = CONTRIB_AGG / TOTAL_NET_REV

NET_PROFIT_AGG  = TOTAL_NET_REV - TOTAL_COGS - TOTAL_VAR_AGG
NPM%_AGG        = NET_PROFIT_AGG / TOTAL_NET_REV

ROAS_AGG        = TOTAL_REVENUE / TOTAL_AD_SPEND   (null if TOTAL_AD_SPEND = 0)
CAC_AGG         = TOTAL_AD_SPEND / TOTAL_QTY       (null if TOTAL_QTY = 0)
ASP_AGG         = TOTAL_REVENUE / TOTAL_QTY        (null if TOTAL_QTY = 0)
```

> Always aggregate raw values first, then compute ratios from aggregates.
> Never average per-unit ratios directly — this gives wrong results.

---

## 8. SKU classification logic

Deterministic. All thresholds are config-driven.

### Default thresholds

```python
MIN_QTY_THRESHOLD       = 5      # below this → WATCHLIST
SCALE_QTY_THRESHOLD     = 25     # above this → eligible for SCALE_READY
TARGET_CM_PCT           = 0.30   # 30% contribution margin
TARGET_NPM_PCT          = 0.10   # 10% net profit margin
TARGET_ROAS             = 2.0
MAX_NEGOTIABLE_RED_PCT  = 0.40   # max 40% COGS reduction considered realistic
```

### Classification rules (evaluated top to bottom)

```
1. if QTY < MIN_QTY_THRESHOLD:
       → WATCHLIST

2. if CAC = 0 and NET_PROFIT > 0:
       → ORGANIC_WINNER

3. if NET_PROFIT > 0 and CM% >= TARGET_CM_PCT and ROAS >= TARGET_ROAS:
       → WINNER

4. if NET_PROFIT > 0 and ROAS >= TARGET_ROAS and QTY >= SCALE_QTY_THRESHOLD:
       → SCALE_READY

5. if NET_PROFIT < 0 and REQUIRED_REDUCTION_PCT <= MAX_NEGOTIABLE_RED_PCT and REQUIRED_REDUCTION_PCT > 0:
       → PROCUREMENT_OPPORTUNITY

6. if NET_PROFIT < 0 and CM% > 0:
       → BORDERLINE

7. if NET_PROFIT < 0:
       → LOSER
```

---

## 9. Recommended action strings

Deterministic text mapped from classification + metrics.

| Status | Condition | Recommended action |
|---|---|---|
| WINNER | REQUIRED_REDUCTION <= 0 | "Scale cautiously; cost already below target." |
| WINNER | default | "Healthy unit economics. Increase ad spend with CAC guardrail." |
| SCALE_READY | — | "Push ad spend. Monitor CAC does not exceed ₹{BE_CAC}." |
| ORGANIC_WINNER | — | "Protect organic channel. Test paid spend carefully." |
| PROCUREMENT_OPPORTUNITY | — | "Negotiate vendor cost to ₹{TARGET_VENDOR_COST} ({REDUCTION_PCT}% reduction). Viable if MOQ allows." |
| BORDERLINE | — | "Contribution positive but ad cost kills margin. Cut CAC or renegotiate COGS." |
| LOSER | — | "Pause scaling. Unit economics broken at current cost and volume." |
| WATCHLIST | — | "Insufficient volume for confident decision. Monitor for 2 more weeks." |

---

## 10. Divide-by-zero and null safety rules

Every formula must implement these guards.

```python
def safe_div(numerator, denominator, fallback=None):
    if denominator is None or denominator == 0:
        return fallback
    return numerator / denominator

# Applied in:
CM%           → safe_div(CONTRIBUTION, NET_REV, fallback=None)
NPM%          → safe_div(NET_PROFIT, NET_REV, fallback=None)
ROAS          → safe_div(ASP, CAC, fallback=None)      # null = organic
CAC_AGG       → safe_div(AD_SPEND, QTY, fallback=0)
REDUCTION_PCT → safe_div(REQUIRED_REDUCTION, COGS, fallback=None)
ORDERS_REQ    → None if NET_PROFIT <= 0
```

Additional rules:
- If `QTY = 0`, mark all per-unit ratios as `null`. Do not compute.
- If `AD_SPEND = 0`, set `CAC = 0`, `ROAS = null`, tag channel as `organic`.
- If `COGS = null`, set `CONTRIBUTION = null`, `NET_PROFIT = null`, classify as `WATCHLIST`.
- Never impute or estimate missing COGS. Flag the row and skip classification.
- All money values use `decimal.Decimal` in Python. Never `float` for financial math.

---

## 11. Formula dependency map

```
ASP
 └─ NET_REV  (÷ GST factor)
     ├─ PGW_COST   (× PGW%)
     ├─ RTO_COST   (× RTO%)
     ├─ MKT_COST   (× MKT%)
     ├─ CONTRIBUTION  (- COGS)
     │    └─ CM%   (÷ NET_REV)
     ├─ TOTAL_VAR  (CAC + SHIP + PKG + PGW_COST + RTO_COST + COD + MKT_COST)
     ├─ NET_PROFIT  (- COGS - TOTAL_VAR)
     │    ├─ NPM%           (÷ NET_REV)
     │    └─ ORDERS_REQUIRED (TARGET_PROFIT ÷ NET_PROFIT)
     │         ├─ AD_SPEND_REQUIRED  (× CAC)
     │         └─ EXPECTED_REVENUE   (× ASP)
     ├─ BE_VENDOR_COST     (- TOTAL_VAR)
     └─ TARGET_VENDOR_COST (× (1 - TARGET_MARGIN%) - TOTAL_VAR)
          └─ REQUIRED_REDUCTION      (COGS - TARGET_VENDOR_COST)
               └─ REQUIRED_REDUCTION_PCT  (÷ COGS)

CAC
 ├─ TOTAL_VAR
 ├─ ROAS   (ASP ÷ CAC)
 └─ AD_SPEND_PCT  (CAC ÷ ASP)
```

---

## 12. Sample calculation (TH-198 UFO Ball — loss-making SKU)

```
Inputs:
  ASP       = ₹980
  COGS      = ₹430
  CAC       = ₹620
  SHIP      = ₹90
  RTO%      = 12%
  PGW%      = 2%
  GST_INCL  = true, TAX_RATE = 18%
  TARGET_MARGIN% = 10%
  TARGET_PROFIT  = ₹80,000

Step 1 — Net revenue:
  NET_REV = 980 / 1.18 = ₹830.51

Step 2 — Variable costs:
  PGW_COST  = 830.51 × 0.02 = ₹16.61
  RTO_COST  = 830.51 × 0.12 = ₹99.66
  TOTAL_VAR = 620 + 90 + 16.61 + 99.66 = ₹826.27

Step 3 — Unit economics:
  CONTRIBUTION = 830.51 - 430     = ₹400.51
  CM%          = 400.51 / 830.51  = 48.2%
  NET_PROFIT   = 830.51 - 430 - 826.27 = -₹425.76   ← loss
  ROAS         = 980 / 620        = 1.58x

Step 4 — Break-even and target cost:
  BE_VENDOR_COST     = 830.51 - 826.27 = ₹4.24
  TARGET_VENDOR_COST = 830.51 × (1 - 0.10) - 826.27 = 747.46 - 826.27 = -₹78.81

  → Both are negative. This SKU cannot be made profitable
    through vendor negotiation alone at current CAC and RTO.

Step 5 — Classification:
  NET_PROFIT < 0, CM% > 0, REQUIRED_REDUCTION_PCT > MAX_NEGOTIABLE_RED_PCT
  → BORDERLINE

  Recommended action:
  "Contribution positive but ad cost kills margin. Cut CAC below ₹400 or renegotiate COGS."

Step 6 — Scale (not applicable):
  ORDERS_REQUIRED = null  (NET_PROFIT <= 0)
```

---

## 13. Sample calculation (TH-101 Lumenpool — profitable SKU)

```
Inputs:
  ASP       = ₹1,850
  COGS      = ₹476
  CAC       = ₹538
  SHIP      = ₹80
  RTO%      = 8%
  PGW%      = 2%
  GST_INCL  = true, TAX_RATE = 18%
  TARGET_MARGIN% = 10%
  TARGET_PROFIT  = ₹80,000

Step 1 — Net revenue:
  NET_REV = 1850 / 1.18 = ₹1,567.80

Step 2 — Variable costs:
  PGW_COST  = 1567.80 × 0.02 = ₹31.36
  RTO_COST  = 1567.80 × 0.08 = ₹125.42
  TOTAL_VAR = 538 + 80 + 31.36 + 125.42 = ₹774.78

Step 3 — Unit economics:
  CONTRIBUTION = 1567.80 - 476    = ₹1,091.80
  CM%          = 1091.80 / 1567.80 = 69.6%
  NET_PROFIT   = 1567.80 - 476 - 774.78 = ₹317.02
  ROAS         = 1850 / 538       = 3.44x

Step 4 — Break-even and target cost:
  BE_VENDOR_COST     = 1567.80 - 774.78 = ₹793.02
  TARGET_VENDOR_COST = 1567.80 × 0.90 - 774.78 = 1411.02 - 774.78 = ₹636.24
  REQUIRED_REDUCTION = 476 - 636.24 = -₹160.24  (negative = already below target)
  REQUIRED_REDUCTION_PCT = -0.337  (no reduction needed)

Step 5 — Classification:
  NET_PROFIT > 0, CM% >= 0.30, ROAS >= 2.0
  → WINNER

Step 6 — Scale:
  ORDERS_REQUIRED    = ceil(80000 / 317.02) = 253 orders
  AD_SPEND_REQUIRED  = 253 × 538            = ₹136,114
  EXPECTED_REVENUE   = 253 × 1850           = ₹468,050
  EXPECTED_PROFIT    = 253 × 317.02         = ₹80,206
```

---

## 14. Python function signatures (simulation engine)

```python
from decimal import Decimal
from typing import Optional

def calculate_net_revenue(asp: Decimal, tax_rate: Decimal, gst_inclusive: bool) -> Decimal: ...

def calculate_variable_costs(
    net_rev: Decimal,
    cac: Decimal,
    shipping: Decimal,
    packaging: Decimal,
    pgw_pct: Decimal,
    rto_pct: Decimal,
    cod: Decimal,
    marketplace_pct: Decimal,
) -> Decimal: ...

def calculate_unit_economics(
    net_rev: Decimal,
    cogs: Decimal,
    total_var: Decimal,
    asp: Decimal,
    cac: Decimal,
) -> dict: ...
# returns: contribution, cm_pct, net_profit, npm_pct, roas, ad_spend_pct

def calculate_breakeven_cost(net_rev: Decimal, total_var: Decimal) -> Decimal: ...

def calculate_target_vendor_cost(
    net_rev: Decimal,
    total_var: Decimal,
    target_margin_pct: Decimal,
) -> Decimal: ...

def calculate_required_reduction(
    cogs: Decimal,
    target_vendor_cost: Decimal,
) -> tuple[Decimal, Optional[Decimal]]: ...
# returns: (absolute_reduction, reduction_pct)

def calculate_scale_plan(
    net_profit_per_unit: Decimal,
    target_absolute_profit: Decimal,
    cac: Decimal,
    asp: Decimal,
) -> Optional[dict]: ...
# returns: orders_required, ad_spend_required, expected_revenue, expected_profit
# returns None if net_profit_per_unit <= 0

def classify_sku(
    net_profit: Decimal,
    cm_pct: Decimal,
    roas: Optional[Decimal],
    required_reduction_pct: Optional[Decimal],
    quantity: int,
    cac: Decimal,
    thresholds: dict,
) -> str: ...
# returns: WINNER | SCALE_READY | BORDERLINE | PROCUREMENT_OPPORTUNITY |
#          LOSER | ORGANIC_WINNER | WATCHLIST

def simulate_sku_profitability(
    sku_id: str,
    asp: Decimal,
    cogs: Decimal,
    cac: Decimal,
    shipping: Decimal,
    packaging: Decimal,
    pgw_pct: Decimal,
    rto_pct: Decimal,
    tax_rate: Decimal,
    gst_inclusive: bool,
    target_margin_pct: Decimal,
    target_absolute_profit: Decimal,
    thresholds: dict,
) -> dict: ...
# master function — calls all of the above and returns full simulation output
```

---

*Last updated: 2026-05-24*
*Formula version: v1.0 — matches simulation panel demo*