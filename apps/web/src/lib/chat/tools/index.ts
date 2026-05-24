import type { SchemaCache } from "@/lib/cube-client"
import { createPnlTools, getPnlInstructions } from "./pnl-tools"
import { queryTools, getQueryInstructions } from "./query-tools"
import { createSchemaTool } from "./schema-tool"

export function createChatTools(schema: SchemaCache) {
  return {
    ...createPnlTools(schema),
    ...queryTools,
    ...createSchemaTool(schema),
  }
}

/** Aggregates per-domain instructions. Add new tool modules here. */
export function buildDomainInstructions(schema: SchemaCache): string {
  return [getPnlInstructions(schema), getQueryInstructions()].join("\n\n")
}
