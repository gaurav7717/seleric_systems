import "server-only"

import { callCubeTool } from "@/lib/cube-client"
import { extractRows, type CubeRow } from "@/lib/chat/cube-rows"
import { IST_TIMEZONE } from "@/lib/chat/pnl"

export async function runCubeQuery(query: Record<string, unknown>): Promise<CubeRow[]> {
  const raw = await callCubeTool("cube_query", {
    query: { timezone: IST_TIMEZONE, limit: 500, ...query },
  })
  return extractRows(raw)
}

export async function runCubeToolRows(
  toolName: string,
  args: Record<string, unknown>
): Promise<CubeRow[]> {
  const raw = await callCubeTool(toolName, args)
  return extractRows(raw)
}
