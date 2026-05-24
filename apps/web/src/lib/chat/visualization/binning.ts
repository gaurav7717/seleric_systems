export type HistogramBin = {
  label: string
  count: number
  min: number
  max: number
}

export function histogramBins(values: number[], binCount = 12): HistogramBin[] {
  const filtered = values.filter((v) => isFinite(v))
  if (!filtered.length) return []

  const min = Math.min(...filtered)
  const max = Math.max(...filtered)
  if (min === max) {
    return [{ label: String(min), count: filtered.length, min, max }]
  }

  const step = (max - min) / binCount
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    label: "",
    count: 0,
    min: min + i * step,
    max: min + (i + 1) * step,
  }))

  for (const v of filtered) {
    let idx = Math.floor((v - min) / step)
    if (idx >= binCount) idx = binCount - 1
    bins[idx].count++
  }

  return bins.map((b) => ({
    ...b,
    label: `${Math.round(b.min)}–${Math.round(b.max)}`,
  }))
}

export type BoxPlotStats = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export function boxPlotStats(values: number[]): BoxPlotStats | null {
  const sorted = values.filter(isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null

  const q = (p: number) => {
    const pos = (sorted.length - 1) * p
    const base = Math.floor(pos)
    const rest = pos - base
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base])
    }
    return sorted[base]
  }

  return {
    min: sorted[0],
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
    max: sorted[sorted.length - 1],
  }
}
