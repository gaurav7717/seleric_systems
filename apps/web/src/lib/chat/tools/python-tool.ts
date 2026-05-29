import { z } from "zod"
import { fail, okRows, runTool } from "../tool-result"
import type { ChatToolResult } from "../tool-result"

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8000"

async function callSandbox(
  code: string,
  data: Record<string, unknown>[],
  timeoutSeconds: number,
): Promise<{ rows?: Record<string, unknown>[]; scalar?: unknown; chart_hint?: string; stdout: string; error?: string; execution_ms: number }> {
  const res = await fetch(`${SANDBOX_URL}/sandbox/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, data, timeout_seconds: timeoutSeconds }),
    signal: AbortSignal.timeout((timeoutSeconds + 5) * 1000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Sandbox HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export function getPythonInstructions(): string {
  return `## Python analysis tool
- **runPythonAnalysis** — Execute Python (pandas/numpy) on rows already fetched from Cube.
  Use when the user asks for: custom ratios, rolling averages, correlation, pivot tables,
  statistical tests, or any computation that runComputedQuery's built-in types can't express.

## Pattern
1. Fetch data with runQuery or runComputedQuery (capture the rows).
2. Call runPythonAnalysis passing those rows as \`data\` and your Python as \`code\`.

## Writing the code
- Input is available as \`df\` (pandas DataFrame) and \`data\` (list of dicts).
- You MUST assign the output to \`result\`.
- \`result\` can be a DataFrame, Series, list of dicts, number, string, or dict.
- **DO NOT use \`import\` statements** — all libraries are pre-loaded: \`pd\`, \`np\`, \`math\`, \`statistics\`, \`json\`, \`stats\` (scipy.stats). Using \`import\` raises ImportError in the sandbox.
- No file I/O, no network access.
- Set \`chart_hint = "table"\` (or "bar", "line", "scatter") at module level to guide the chart renderer.

## Example
\`\`\`python
result = (
    df.groupby("channel")[["spend", "revenue"]]
    .sum()
    .assign(roas=lambda x: x["revenue"] / x["spend"])
    .reset_index()
)
\`\`\``
}

export const pythonTools = {
  runPythonAnalysis: {
    description:
      "Run Python (pandas/numpy) on rows already fetched from Cube. Use for custom ratios, rolling averages, correlation, pivots, or any computation the built-in query tools can't express. Pass the rows from a prior tool call as `data`.",
    inputSchema: z.object({
      code: z
        .string()
        .describe(
          "Python code. Input: `df` (DataFrame) and `data` (list of dicts). Must set `result`. Available: pd, np, math, statistics, json."
        ),
      data: z
        .array(z.record(z.unknown()))
        .describe("Rows to analyze — pass the rows returned by a prior runQuery or runComputedQuery call."),
      label: z.string().optional().describe("Short label shown in the UI"),
      timeoutSeconds: z.number().int().min(1).max(30).optional().default(10),
    }),
    execute: ({
      code,
      data,
      label,
      timeoutSeconds = 10,
    }: {
      code: string
      data: Record<string, unknown>[]
      label?: string
      timeoutSeconds?: number
    }) =>
      runTool(async (): Promise<ChatToolResult> => {
        const outcome = await callSandbox(code, data, timeoutSeconds)

        if (outcome.error) {
          return fail(`Python error: ${outcome.error}`)
        }

        const displayLabel = label ?? "Python Analysis"

        const chartHint = outcome.chart_hint ?? undefined

        // Tabular result
        if (outcome.rows && outcome.rows.length > 0) {
          const cleanRows = outcome.rows.map((r) => {
            const { chart_hint: _ch, ...rest } = r as Record<string, unknown> & { chart_hint?: unknown }
            return rest
          })
          return {
            ...okRows(cleanRows, {
              type: chartHint ?? (cleanRows.length <= 6 ? "kpi" : "table"),
              label: displayLabel,
            }),
            chartHint,
          } as ChatToolResult
        }

        // Scalar or dict result — wrap as a single-row table so the UI can render it
        if (outcome.scalar !== undefined && outcome.scalar !== null) {
          const scalar = outcome.scalar
          const row: Record<string, unknown> =
            typeof scalar === "object" && !Array.isArray(scalar)
              ? (scalar as Record<string, unknown>)
              : { result: scalar }
          return okRows([row], { type: "kpi", label: displayLabel })
        }

        // stdout-only result (e.g. code that only prints)
        return {
          ok: true,
          type: "python_stdout",
          label: displayLabel,
          rows: [],
          stdout: outcome.stdout,
        } as ChatToolResult
      }),
  },
}
