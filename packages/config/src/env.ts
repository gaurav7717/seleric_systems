import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  WRITE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(input)
}
