# Chat System

## Overview

The chat system is the founder-facing BI assistant at `/chat`. It is a Next.js client UI backed by a streaming route handler at `/api/chat`. The route builds a live Cube-aware system prompt, exposes data tools to the model, streams AI SDK UI messages back to the browser, and lets the frontend render charts directly from tool results before the assistant writes its final interpretation.

The current chat is not the LangGraph signal orchestrator. It runs inside `apps/web` and calls external data services directly:

```
User
  -> /chat page
  -> ChatView client component
  -> POST /api/chat
  -> AI SDK streamText
  -> chat tools
       -> Seleric Cube MCP
       -> optional Python sandbox on orchestrator
  -> streamed UIMessage parts
  -> InsightCanvas charts + assistant markdown
```

Primary goals:

- Answer ad, Shopify, revenue, spend, P&L, trend, and channel questions from live data.
- Fetch data before answering business questions.
- Render the data result as a visual canvas first, then keep the text response concise.
- Support multi-step analysis through schema exploration, Cube queries, computed analysis, cross-cube joins, and Python post-processing.
- Fail gracefully on model rate limits and tool errors.

## Main Files

Route and model layer:

- `apps/web/src/app/chat/page.tsx` mounts the chat UI client-only and shows the debug log panel in development.
- `apps/web/src/app/api/chat/route.ts` handles streaming chat requests, builds the prompt, creates tools, resolves models, and manages fallback behavior.
- `apps/web/src/lib/chat/model.ts` resolves primary, fallback, data, and analysis models from environment variables.
- `apps/web/src/lib/chat/system-prompt.ts` builds the full model instructions from base rules, domain/tool instructions, and live Cube schema context.
- `apps/web/src/lib/cube-client.ts` connects to Seleric MCP over SSE, calls Cube tools, parses results, and caches `cube_meta` schema for one hour.

Client UI:

- `apps/web/src/components/chat/ChatView.tsx` owns message state, input handling, retry behavior, streaming status labels, and assistant rendering.
- `apps/web/src/components/chat/AssistantMarkdown.tsx` renders final assistant prose with GFM markdown styling.
- `apps/web/src/components/chat/DebugLogPanel.tsx` polls `/api/debug/logs` in development.
- `apps/web/src/components/chat/ToolResult.tsx` contains inline tool status/error rendering helpers. Most successful data output is rendered by `InsightCanvas`, not inline.
- `apps/web/src/components/chat/ChainOfThought.tsx` can render tool-step traces from partitioned assistant messages.

Message partition and result merging:

- `apps/web/src/lib/chat/partition-message.ts` splits streamed assistant parts into short tool-step narration, final narrative text, clarify prompts, and merged chart data.
- `apps/web/src/lib/chat/tool-part.ts` normalizes AI SDK tool part names and states.
- `apps/web/src/lib/chat/tool-result.ts` defines the standard `ChatToolResult` shape returned by tools.
- `apps/web/src/lib/chat/merge-tool-results.ts` chooses which tool outputs should drive the visual canvas.

Tools:

- `apps/web/src/lib/chat/tools/index.ts` registers all chat tools and concatenates tool/domain instructions.
- `apps/web/src/lib/chat/tools/pnl-tools.ts` provides P&L-specific tools.
- `apps/web/src/lib/chat/tools/query-tools.ts` provides generic Cube query, computed query, cross-cube merge, and clarification tools.
- `apps/web/src/lib/chat/tools/schema-tool.ts` exposes live Cube schema metadata to the model.
- `apps/web/src/lib/chat/tools/python-tool.ts` calls the Python sandbox for post-query analysis.
- `apps/web/src/lib/chat/computed-query.ts` performs in-process TypeScript computations on Cube rows.
- `apps/web/src/lib/chat/pnl.ts` wraps daily P&L, P&L trends, channel splits, and CAC enrichment.

Visualization:

- `apps/web/src/components/chat/insight/InsightCanvas.tsx` is the top-level visual output surface for merged tool data.
- `apps/web/src/lib/chat/visualization/detect-chart-plan.ts` infers chart kinds and layouts from rows.
- `apps/web/src/lib/chat/visualization/normalize-rows.ts` enriches and normalizes rows before charting.
- `apps/web/src/components/chat/charts/ChartRenderer.tsx` dispatches each chart plan to the concrete chart component.
- `apps/web/src/components/chat/insight/CompiledInsights.tsx` renders deterministic auto-generated insights from tool results.
- `apps/web/src/lib/chat/visualization/generate-compiled-insights.ts` builds those deterministic insight bullets.

Python sandbox:

- `services/orchestrator/src/main.py` includes the sandbox router.
- `services/orchestrator/src/sandbox/routes.py` exposes `POST /sandbox/execute`.
- `services/orchestrator/src/sandbox/executor.py` executes restricted Python over rows passed from chat.

## Request Flow

The user enters text in `ChatView`.

`ChatView` uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport({ api: "/api/chat" })`. Submitting sends the current UI message list to the route. The input supports Enter to send and Shift+Enter for a newline.

`POST /api/chat` then:

1. Reads `body.messages`.
2. Loads the Cube schema through `loadSchema()`.
3. Builds the system prompt with `buildChatSystemPrompt(schema)`.
4. Converts UI messages to model messages with `convertToModelMessages`.
5. Creates tools with `createChatTools(schema)`.
6. Resolves primary and fallback model choices.
7. Optionally preflights the primary model with a small `generateText` call.
8. Starts `streamText`.
9. Returns `result.toUIMessageStreamResponse()`.

During streaming, the model can emit text parts and tool parts. The UI does not wait for the final answer to render data. As soon as tool outputs are available in assistant message parts, `partitionAssistantMessage` collects them, `mergeToolOutputs` selects the best dataset, and `InsightCanvas` renders charts.

## Streaming Behavior

The route uses AI SDK's UI message stream format. The frontend receives incremental `UIMessage` parts:

- Text parts are either short step narration or final assistant narrative.
- Tool parts move through states such as `input-streaming`, `input-available`, `output-available`, and `output-error`.
- Running tools show status text such as "Fetching live data...".
- Tool output errors can be surfaced without crashing the full UI.

`ChatView` shows these status labels:

- "Starting analysis..." when the user message has been submitted and no assistant message exists yet.
- "Thinking..." when the assistant is streaming but has not started tools or narrative.
- "Fetching live data..." when any tool is currently running.
- "Building analysis..." after tool activity when the final narrative has not appeared yet.

The assistant message renderer does three jobs:

1. Shows `InsightCanvas` if any data tool returned rows.
2. Shows final markdown narrative after the charts.
3. Shows a clarify prompt with quick-reply buttons if the `clarify` tool was used.

## Model Routing

The route supports a split-model strategy:

- Primary model: the default model used by `/api/chat`.
- Data model: used for tool-calling steps.
- Analysis model: used for final text after a configured number of tool steps.
- Fallback model: used when the primary is unhealthy or rate-limited.

`buildStreamOptions` reads:

- `CHAT_MAX_TOOL_STEPS`, default `20`, for the handoff from data model to analysis model.
- `CHAT_SAFETY_STEP_CAP`, default `30`, for runaway loop prevention.
- `AZURE_DATA_TEMPERATURE` or `CHAT_DATA_TEMPERATURE`, default `0`, for deterministic tool calls.
- `AZURE_ORCHESTRATOR_TEMPERATURE` or `CHAT_ANALYSIS_TEMPERATURE`, default `0.1`, for final narrative.

If the configured data and analysis deployments are different, `prepareStep` keeps early steps on the data model. After the handoff threshold, it switches to the analysis model and disables tools so the model produces final text only.

The safety cap is intentionally separate from the routing threshold. It is only a loop guard and should not be set low enough to truncate normal multi-tool analysis.

## Rate Limit and Fallback Behavior

`route.ts` keeps short in-memory health state for the primary model:

- Healthy preflight cache TTL: `60s`.
- Rate-limit failure TTL: `5min`.
- Non-rate-limit failure TTL: `60s`.

Fallback can happen in three places:

1. Before streaming starts: primary preflight fails, so the request starts with fallback.
2. Before the response body opens: `streamText` throws, so the route retries with fallback.
3. During streaming but before user-visible text is flushed: the route buffers early stream chunks and can transparently restart with fallback if it detects a rate-limit error.

If a rate limit occurs after user-visible text has already streamed, the route cannot safely restart the response. It marks the primary failed so the next retry uses fallback, and the UI shows a partial-result warning.

The client retry button calls `regenerate()` after removing a failed trailing assistant message and collapsing duplicate consecutive user messages.

## System Prompt Behavior

`buildChatSystemPrompt` combines:

- Base BI assistant instructions from `system-prompt.ts`.
- Cube routing and domain gotchas from `instructions/cube-domain.ts`.
- Tool-specific usage instructions from `tools/index.ts`.
- Live Cube inventory from `buildSchemaContext(schema)`.

Important behavior enforced in the prompt:

- Always use IST.
- Resolve "today", "yesterday", and "last 7 days" to concrete IST dates.
- Fetch real data before answering business questions.
- Use `exploreSchema` before generic Cube queries when exact field names are needed.
- Do not stop after schema exploration; schema calls must be followed by actual data-fetching tools.
- Write one short sentence before each tool call; the UI treats that as step narration.
- Keep final answers as concise executive interpretation because charts render the numbers.
- Use `getDailyPnl` or `getPnlTrend` for P&L instead of manually recomputing net profit.
- Use `runPythonAnalysis` to compile large raw result sets before rendering.
- Use `mergeQueryResults` or Python when multiple raw queries need to become one final visual result.

## Tool Catalog

### `getDailyPnl`

Purpose: P&L for a single day or date range.

Inputs:

- `startDate`
- `endDate`
- `groupByDay`
- optional `metrics`

Behavior:

- Calls Seleric `cube_daily_pnl`.
- Adds derived CAC through `enrichPnlRows`.
- Returns `type: "kpi"` for aggregate output or `type: "trend"` for day-level rows.
- If `metrics` is provided, filters the returned row keys to the requested metrics plus date fields.

Use for:

- Period totals.
- Simple revenue vs spend charts.
- Day-by-day P&L trend when `groupByDay` is true.

### `getPnlTrend`

Purpose: P&L time series by day, week, or month.

Inputs:

- `startDate`
- `endDate`
- `granularity`

Behavior:

- Calls generic `cube_query` against `daily_pnl`.
- Uses schema-derived `daily_pnl` measures when available.
- Adds derived CAC.
- Returns `type: "trend"` and may set `layout: "pnl_dashboard"` when enough rows exist.

Use for:

- Monthly P&L.
- Weekly P&L.
- CAC trend.
- Full P&L dashboard output.

### `getChannelBreakdown`

Purpose: Meta, Google, and Organic split.

Inputs:

- `startDate`
- optional `endDate`

Behavior:

- Calls Seleric `cube_channel_pnl`.
- Converts the wide channel row into chart rows with `channel`, `revenue`, `adSpend`, `netProfit`, and `orders`.
- Returns `type: "channel"`.

### `exploreSchema`

Purpose: expose exact Cube measures and dimensions.

Inputs:

- optional `cubeName`

Behavior:

- With `cubeName`, returns one cube's measure and dimension metadata.
- Without `cubeName`, returns all cubes with measure and dimension summaries.
- Returns available cube names when a cube is not found.

Use before `runQuery`, `runComputedQuery`, or `mergeQueryResults` when the model needs exact field names.

### `runQuery`

Purpose: generic Cube query.

Inputs:

- `query`
- optional `label`

Behavior:

- Adds `timezone: "Asia/Kolkata"`.
- Calls Seleric `cube_query`.
- Extracts rows from common Cube response shapes.
- Detects a basic result type: `trend`, `channel`, `kpi`, or `table`.

Use for:

- Standard aggregation.
- Campaign, adset, order, product, funnel, geography, and custom metric questions.
- Time trends when the query has a time dimension granularity.

### `runComputedQuery`

Purpose: fetch Cube rows and compute in TypeScript.

Inputs:

- `fetchQuery`
- `compute`
- optional `label`

Compute types:

- `pair_count`: market basket or co-purchase analysis.
- `group_by`: sum numeric columns by one or more keys.
- `top_n`: sort by a numeric column.
- `raw`: return fetched rows as-is.
- `formula`: derive `outputColumn = numerator / denominator * scale`.

Behavior:

- Adds `limit: 100000` and IST timezone to the fetch query.
- Runs computation in `computed-query.ts`.
- Returns chart type based on compute type and row count.

Use for:

- Nested aggregate recovery.
- Derived ratios from fetched columns.
- Top-N rankings.
- Cross-row logic that Cube cannot express.

### `mergeQueryResults`

Purpose: fetch two Cube queries and join them into one result.

Inputs:

- `queryA`
- `queryB`
- `joinKey`
- optional `joinType`, `inner` or `left`
- optional `label`

Behavior:

- Runs both Cube queries in parallel.
- Joins rows by the provided key, accepting either full field name or suffix match.
- Sorts the merged result by a significant measure such as revenue, attributed value, spend, or profit when possible.
- Returns one final merged dataset for the canvas.

Use for:

- Cross-cube campaign spend plus attribution.
- Any question where one visual/table needs fields from two Cube result sets.

### `runPythonAnalysis`

Purpose: execute restricted Python over rows already fetched from Cube.

Inputs:

- `code`
- `data`
- optional `label`
- optional `timeoutSeconds`, 1 to 30 seconds

Behavior:

- Calls `POST {SANDBOX_URL}/sandbox/execute`.
- Injects `df`, `data`, `pd`, `np`, `math`, `statistics`, and helpers into the sandbox.
- Requires code to assign `result`.
- Converts DataFrame, Series, list of dicts, scalar, or dict output into a standard chat tool result.
- Returns scalar/dict output as a one-row KPI table.

Use for:

- Custom ratios.
- Rolling averages.
- Correlations.
- Pivots.
- Flags and filters over large result sets.
- Final compilation after raw query or merged query output.

Current note: the web tool returns rows/scalars/stdout, but does not currently pass through sandbox `chart_hint` or `secondary` fields even though the backend response supports them.

### `clarify`

Purpose: ask a targeted follow-up when the request is genuinely ambiguous.

Inputs:

- `question`
- optional `options`

Behavior:

- Returns `type: "clarify"`.
- `partitionAssistantMessage` turns it into a `ClarifyBubble`.
- Clicking an option sends that option as the next user message.

Use sparingly. The prompt tells the model to make safe assumptions for minor ambiguity.

## Tool Result Shape

Every tool returns `ChatToolResult`:

```
{
  ok: boolean
  rows?: Record<string, unknown>[]
  type?: string
  layout?: string
  suggestedCharts?: ChartKind[]
  label?: string
  error?: string
  query?: Record<string, unknown>
  cube?: unknown
  cubes?: unknown[]
  available?: string[]
  question?: string
  options?: string[]
  chartHint?: string
  secondary?: Record<string, unknown>
  stdout?: string
}
```

Successful data tools should set `ok: true` and usually include `rows`. Failed tools should return `ok: false` and `error`; `runTool` wraps thrown exceptions into that shape.

## How Data Becomes A Canvas

`partitionAssistantMessage` walks the streamed `UIMessage.parts`.

For text parts:

- Short text before or between tools is treated as tool-step narration.
- Longer text or sectioned markdown is treated as final narrative.

For tool parts:

- Tool state becomes a `CotStep`.
- Finished data tool output is collected for merging.
- `clarify` output becomes a `ClarifyPrompt`.

`mergeToolOutputs` then decides which rows should drive the canvas.

Priority rules:

- `runPythonAnalysis` and `mergeQueryResults` are final tools and always win over raw fetches.
- `runComputedQuery` wins over raw `runQuery` unless a final tool exists.
- `getPnlTrend` always owns the primary time-series slot.
- `getDailyPnl` contributes summary rows for KPI cards when output is small.
- `getChannelBreakdown` contributes separate channel rows.
- If no preferred rows are selected, the longest successful dataset is used.

This is why compound answers should end with one refined final tool call. The UI renders one main canvas per assistant message.

## Visualization Behavior

`InsightCanvas` receives `MergedToolData` and:

1. Chooses chart rows from P&L series rows or primary series rows.
2. Calls `detectChartPlan`.
3. Normalizes rows with derived metrics and display labels.
4. Shows KPI summaries when layout requires them.
5. Renders one chart, multiple charts, a P&L dashboard, or a table fallback.
6. Renders channel breakdown separately when channel rows exist.
7. Adds deterministic compiled insights under the visual output.

Chart detection supports:

- P&L dashboard
- Summary KPI
- Table
- Line and area charts
- Dual-line charts
- Bar, grouped bar, stacked bar, horizontal bar, diverging bar
- Scatter and bubble charts
- Pie, donut, treemap, radar
- Funnel
- Waterfall
- Heatmap
- Histogram

High-level detection rules:

- P&L-shaped time series with enough rows becomes a P&L dashboard.
- Channel/category output becomes grouped bar.
- Few aggregate rows with multiple metrics become KPI cards.
- Category plus one metric becomes pie or horizontal bar depending on category count.
- Category plus two rate metrics becomes labeled scatter for outlier analysis.
- Time series becomes trend charts with table fallback.
- Large numeric distributions can become histograms.
- Unknown shapes fall back to table.

`CompiledInsights` is deterministic UI-side analysis. It computes period totals, trend movement, CAC/LTV proxy notes, channel leaders, and simple takeaways from the same rows used by charts. This is separate from the model's final narrative.

## UI Behavior

Empty state:

- Shows "BI Assistant".
- Shows suggested prompts:
  - "How are we doing today?"
  - "Give me CAC and LTV from April 2025 to April 2026"
  - "Show me the last 7 days P&L trend"
  - "Which channel is performing best?"
  - "Show me last 30 days revenue vs spend"

User messages:

- Render as right-aligned bubbles.
- Consecutive duplicate user messages are hidden defensively.

Assistant messages:

- Render full-width.
- Show charts before final text.
- Add an "Analysis" divider between chart output and narrative when data exists.
- Show clarification quick replies after streaming completes.

Errors:

- Rate-limit errors show an amber warning explaining that partial results may be visible and retry will use fallback.
- Other errors show a red error block.
- Raw JSON-looking error messages are replaced with a clean user-facing message.

Development logging:

- `DebugLogPanel` appears only outside production.
- It polls `/api/debug/logs?since=...` every 1.5 seconds while open.
- It shows recent server logs from `serverLog`, capped client-side to the latest 300 entries.

## Python Sandbox Behavior

The sandbox runs inside the orchestrator FastAPI service, not inside the Next.js process.

Request:

```
POST /sandbox/execute
{
  "code": "...",
  "data": [{ "...": "..." }],
  "datasets": {},
  "timeout_seconds": 10
}
```

Injected variables:

- `df`: pandas DataFrame built from `data`.
- `data`: original list of dictionaries.
- `<name>_df`: named DataFrames for entries in `datasets`.
- `pd`, `np`, `math`, `re`, `json`, `statistics`, date/time helpers.
- Analytics helpers: `moving_avg`, `pct_change`, `yoy`, `top_n`, `compare_periods`, `cohort_retention`, `funnel`, `describe`, `anomalies`, `corr`, `pivot`, `growth_rates`, `ttest`, `pearsonr`.

Restrictions and limits:

- Uses `RestrictedPython`.
- No arbitrary imports.
- No file I/O or network access.
- Input rows are capped at 10,000.
- Output rows are capped at 2,000.
- Timeout is 1 to 30 seconds.
- Code must assign `result` or `results`.
- Code may set `chart_hint`, though the current web tool does not pass it through to the UI result.

Response:

```
{
  "rows": [],
  "scalar": null,
  "secondary": {},
  "chart_hint": null,
  "stdout": "",
  "error": null,
  "execution_ms": 123
}
```

## Configuration

Chat route and models:

- `AZURE_OPENAI_API_KEY`: enables Azure model usage.
- `AZURE_OPENAI_ENDPOINT`: Azure endpoint used to derive resource name.
- `AZURE_ORCHESTRATOR_DEPLOYMENT`: primary Azure deployment.
- `AZURE_FALLBACK_DEPLOYMENT`: fallback Azure deployment and optional data fallback.
- `AZURE_DATA_DEPLOYMENT`: data/tool-calling deployment.
- `AZURE_ANALYSIS_DEPLOYMENT`: final narrative deployment.
- `AZURE_DATA_TEMPERATURE`: data model temperature.
- `AZURE_ORCHESTRATOR_TEMPERATURE`: final analysis temperature.
- `OPENAI_API_KEY`: enables OpenAI-compatible provider.
- `OLLAMA_CLOUD_API_KEY`: alternate OpenAI-compatible API key.
- `OLLAMA_CLOUD_URL`: alternate OpenAI-compatible base URL.
- `ORCHESTRATOR_MODEL` or `LLM_MODEL`: OpenAI-compatible primary model id.
- `DATA_MODEL`: OpenAI-compatible data model override.
- `ANALYSIS_MODEL`: OpenAI-compatible analysis model override.
- `CHAT_DATA_TEMPERATURE`: non-Azure data temperature fallback.
- `CHAT_ANALYSIS_TEMPERATURE`: non-Azure analysis temperature fallback.
- `CHAT_MAX_TOOL_STEPS`: model handoff threshold.
- `CHAT_SAFETY_STEP_CAP`: loop-prevention cap.

Cube:

- `CUBE_MCP_URL`: Seleric MCP SSE URL. Defaults to `https://mcp.seleric.com/sse`.
- `SELERIC_API_KEY`: bearer token for Seleric MCP.
- `CUBEJS_API_SECRET`: fallback auth path that builds a short-lived JWT.

Sandbox:

- `SANDBOX_URL`: base URL used by the web chat Python tool. Defaults to `http://localhost:8000`.

Debug:

- `NODE_ENV`: hides `DebugLogPanel` in production.

## Adding A New Chat Tool

1. Create a tool module under `apps/web/src/lib/chat/tools/`.
2. Define an AI SDK-compatible tool object with `description`, `inputSchema`, and `execute`.
3. Wrap execution in `runTool` so thrown errors become `{ ok: false, error }`.
4. Return `ChatToolResult`; include rows for anything that should render in the canvas.
5. Add the tool to `createChatTools` in `tools/index.ts`.
6. Add usage instructions to `buildDomainInstructions` through the tool module.
7. Add the tool name to `DATA_TOOLS` in `merge-tool-results.ts` if it returns renderable data.
8. Add a friendly label in `partition-message.ts` and `ToolResult.tsx`.
9. Update chart detection or visualization components only if the existing row-shape detection is insufficient.
10. Add focused tests for query/result logic where possible.

## Adding A New Chart Type

1. Add the kind to `ChartKind` in `visualization/types.ts`.
2. Teach `detectChartPlan` when to emit that kind.
3. Add a renderer case in `ChartRenderer`.
4. Build the chart component under `components/chat/charts/` or reuse an existing chart view.
5. Make sure `normalizeRows`, labels, and tool result row shapes provide the keys the chart expects.
6. Add or update detection tests under `apps/web/src/lib/chat/visualization/__tests__/`.

## Debugging Playbook

Model does not call tools:

- Check the built system prompt length in server logs.
- Confirm `loadSchema()` succeeds and returns cubes.
- Check that the user request is not being interpreted as non-business small talk.

Model stops after schema exploration:

- The prompt explicitly forbids this. Check whether the analysis model handoff happened too early and disabled tools before a data query.
- Increase `CHAT_MAX_TOOL_STEPS` if needed.

Wrong field names:

- Confirm the model called `exploreSchema` for the relevant cube.
- Check `cube-domain.ts` for missing routing guidance.

No chart appears:

- Confirm the final selected data tool returned `ok: true` and non-empty `rows`.
- Check whether `mergeToolOutputs` chose a later refined tool with empty rows.
- Check `detectChartPlan` fallback behavior for the row shape.

Huge table or cluttered chart:

- Prompt guidance says large raw results should be followed by `runPythonAnalysis`.
- For simple metric comparisons, prefer `getDailyPnl` with the `metrics` filter.

Rate-limit errors:

- Retry from the UI. The primary model is marked failed for several minutes and fallback should be selected next.
- Check `AZURE_FALLBACK_DEPLOYMENT` or OpenAI-compatible fallback configuration.

Sandbox errors:

- Confirm the orchestrator is running at `SANDBOX_URL`.
- Check that `services/orchestrator` has pandas, numpy, scipy, and RestrictedPython installed.
- Confirm the Python code assigns `result`.
- Keep input under 10,000 rows and output under 2,000 rows.

## Known Limitations

- The chat route stores model health state in process memory. It is not shared across serverless instances or multiple web replicas.
- The UI renders one main canvas per assistant message. Multi-query answers should compile into one final dataset.
- Python sandbox `chart_hint` and `secondary` are supported by the backend response but are not fully passed through by the current web tool.
- The development debug log panel depends on in-process recent logs.
- `loadSchema()` caches Cube metadata for one hour, so schema changes may not appear immediately.
- The chat endpoint directly accesses Cube and sandbox services; it does not currently route through the LangGraph orchestrator's signal memory or guardrail flow.

## Ownership Boundaries

Use `apps/web/src/lib/chat` for chat-specific model, prompt, tool, message, and visualization logic.

Use `apps/web/src/components/chat` for chat-only UI components.

Use shared dashboard query libraries only when the behavior is intended to be common between dashboards and chat.

Use `services/orchestrator/src/sandbox` only for generic restricted Python execution. Business-specific chat tool orchestration should stay in `apps/web`.
