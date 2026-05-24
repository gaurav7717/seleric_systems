import { z } from "zod"

export const dateRangeSchema = z.object({
  startDate: z.string().describe("Start date YYYY-MM-DD"),
  endDate: z.string().optional().describe("End date YYYY-MM-DD (defaults to startDate)"),
})

export const timeGranularitySchema = z.enum(["hour", "day", "week", "month", "quarter", "year"])

export const cubeTimeDimensionSchema = z.object({
  dimension: z.string(),
  granularity: timeGranularitySchema.optional(),
  dateRange: z.union([z.array(z.string()), z.string()]).optional(),
})

export const cubeFilterSchema = z.object({
  member: z.string(),
  operator: z.string(),
  values: z.array(z.string()).optional(),
})

export const cubeQuerySchema = z.object({
  measures: z.array(z.string()).optional(),
  dimensions: z.array(z.string()).optional(),
  timeDimensions: z.array(cubeTimeDimensionSchema).optional(),
  filters: z.array(cubeFilterSchema).optional(),
  order: z.record(z.string()).optional(),
  limit: z.number().optional(),
  timezone: z.string().optional(),
})

export const computedSpecSchema = z.union([
  z.object({ type: z.literal("pair_count"), groupByDim: z.string(), pairDim: z.string() }),
  z.object({ type: z.literal("group_by"), groupKeys: z.array(z.string()) }),
  z.object({ type: z.literal("top_n"), rankBy: z.string(), n: z.number().optional() }),
  z.object({ type: z.literal("raw") }),
])

export type ComputedSpec = z.infer<typeof computedSpecSchema>
