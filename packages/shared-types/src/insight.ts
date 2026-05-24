export type InsightSeverity = "CRITICAL" | "WARNING" | "INFO"

export interface InsightCard {
  id: string
  signalId: string
  severity: InsightSeverity
  title: string
  what: string
  why: string
  evidence: string[]
  confidence: number
  agent: string
  createdAt: string
  dismissedAt?: string | null
  snoozedUntil?: string | null
}

export interface InsightOutcome {
  id: string
  insightId: string
  measuredAt: string
  windowHours: 24 | 48 | 168
  metricDeltas: {
    roas_delta?: number
    spend_delta?: number
    revenue_delta?: number
    cac_delta?: number
    [key: string]: number | undefined
  }
  outcomeScore: number
}
