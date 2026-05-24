export * from "./action"
export * from "./insight"
export * from "./signal"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCallTrace[]
  timestamp: string
}

export interface ToolCallTrace {
  tool: string
  input: Record<string, unknown>
  result: unknown
  durationMs: number
}

export interface PnLMetrics {
  revenue: number
  adSpend: number
  grossMargin?: number
  netMargin?: number
  mer: number
  roas: number
  cac: number
  aov: number
  deltaWoW: {
    revenue: number
    adSpend: number
    roas: number
    cac: number
    aov: number
  }
}

export interface ChannelMetrics {
  channel: string
  spend: number
  revenue: number
  roas: number
  orders: number
}
