/**
 * Server-side Cube MCP client — calls Seleric MCP via SSE transport.
 * Never import this in client components (Node.js only).
 */
import "server-only"

import type { TextContent } from "@modelcontextprotocol/sdk/types.js"

const MCP_URL = process.env.CUBE_MCP_URL ?? "https://mcp.seleric.com/sse"

async function buildJWT(secret: string): Promise<string> {
  const enc = new TextEncoder()
  const toB64URL = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  const header = toB64URL(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })).buffer)
  const now = Math.floor(Date.now() / 1000)
  const payload = toB64URL(enc.encode(JSON.stringify({ iat: now, exp: now + 3600 })).buffer)
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${payload}`))
  return `${header}.${payload}.${toB64URL(sig)}`
}

async function authHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.SELERIC_API_KEY
  if (apiKey) return { Authorization: `Bearer ${apiKey}` }
  const secret = process.env.CUBEJS_API_SECRET
  if (secret) return { Authorization: `Bearer ${await buildJWT(secret)}` }
  return {}
}

function parseContent(content: unknown[]): unknown {
  for (const block of content) {
    const text = (block as TextContent).text
    if (!text) continue
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return null
}

export async function callCubeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
  const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js")

  const headers = await authHeaders()
  const transport = new SSEClientTransport(new URL(MCP_URL), { requestInit: { headers } })
  const client = new Client({ name: "bi-chat", version: "1.0.0" }, {})

  await client.connect(transport)
  try {
    console.log(`[cube] → ${toolName}`, JSON.stringify(args).slice(0, 200))
    const result = await client.callTool({ name: toolName, arguments: args })
    const parsed = parseContent(result.content as unknown[])
    console.log(`[cube] ← ${toolName}`, JSON.stringify(parsed)?.slice(0, 300))
    return parsed
  } finally {
    await client.close()
  }
}

// ── Schema cache ─────────────────────────────────────────────────────────────

interface CubeMeasure {
  name: string
  title: string
  type: string
  format?: string
  description?: string
}

interface CubeDimension {
  name: string
  title: string
  type: string
  description?: string
}

interface CubeInfo {
  name: string
  title: string
  measures: CubeMeasure[]
  dimensions: CubeDimension[]
}

export interface SchemaCache {
  cheatSheet: string
  cubes: CubeInfo[]
  fetchedAt: number
}

let _schemaCache: SchemaCache | null = null

export async function loadSchema(): Promise<SchemaCache> {
  if (_schemaCache && Date.now() - _schemaCache.fetchedAt < 60 * 60 * 1000) {
    return _schemaCache
  }

  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
  const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js")
  const headers = await authHeaders()
  const transport = new SSEClientTransport(new URL(MCP_URL), { requestInit: { headers } })
  const client = new Client({ name: "bi-chat", version: "1.0.0" }, {})

  await client.connect(transport)
  try {
    const result = await client.callTool({ name: "cube_meta", arguments: {} })
    const text = (result.content as TextContent[])[0]?.text ?? ""
    const jsonStart = text.indexOf("\n{")
    const cheatSheet = jsonStart > -1 ? text.slice(0, jsonStart).trim() : ""
    const schema = jsonStart > -1 ? JSON.parse(text.slice(jsonStart)) : { cubes: [] }

    _schemaCache = {
      cheatSheet,
      cubes: schema.cubes as CubeInfo[],
      fetchedAt: Date.now(),
    }
    return _schemaCache
  } finally {
    await client.close()
  }
}

export function buildSchemaContext(schema: SchemaCache): string {
  const cubeList = schema.cubes.map((c) => `- **${c.name}**: ${c.title}`).join("\n")
  return `${schema.cheatSheet}\n\n## Cube inventory (call exploreSchema for full measure/dimension list)\n${cubeList}`
}

export function getCubeDetails(schema: SchemaCache, cubeName: string): CubeInfo | undefined {
  return schema.cubes.find((c) => c.name === cubeName)
}
