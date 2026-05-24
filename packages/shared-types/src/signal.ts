export type EntityType = "CAMPAIGN" | "ADSET" | "PRODUCT" | "STORE"

export interface Signal {
  id: string
  entityType: EntityType
  entityId: string
  signalType: string
  contextSnapshot: Record<string, unknown>
  traceId: string
  firedAt: string
}
