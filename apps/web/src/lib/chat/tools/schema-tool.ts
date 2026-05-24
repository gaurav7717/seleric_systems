import { z } from "zod"
import { getCubeDetails, type SchemaCache } from "@/lib/cube-client"
import { runTool } from "../tool-result"

export function createSchemaTool(schema: SchemaCache) {
  return {
    exploreSchema: {
      description:
        "Get exact measure and dimension names for a cube. Always call this before runQuery to avoid using wrong field names.",
      inputSchema: z.object({
        cubeName: z.string().optional().describe("Cube name (e.g. 'ad_performance'). Omit to list all."),
      }),
      execute: ({ cubeName }: { cubeName?: string }) =>
        runTool(async () => {
          if (cubeName) {
            const cube = getCubeDetails(schema, cubeName)
            if (!cube) {
              return {
                ok: false,
                error: `Cube '${cubeName}' not found`,
                available: schema.cubes.map((c) => c.name),
              }
            }
            return { ok: true, cube }
          }
          return {
            ok: true,
            cubes: schema.cubes.map((c) => ({
              name: c.name,
              title: c.title,
              measures: c.measures.map((m) => ({ name: m.name, type: m.type, format: m.format })),
              dimensions: c.dimensions.map((d) => ({ name: d.name, type: d.type })),
            })),
          }
        }),
    },
  }
}
