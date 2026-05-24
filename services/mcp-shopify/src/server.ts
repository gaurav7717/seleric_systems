import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import http from "node:http"
import pino from "pino"

import { toolHandlers, tools } from "./tools/index.js"

const logger = pino({ name: "mcp-shopify" })
const PORT = Number(process.env.PORT ?? 3100)

const server = new Server(
  { name: "mcp-shopify", version: "0.1.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = toolHandlers[request.params.name]
  if (!handler) {
    throw new Error(`Unknown tool: ${request.params.name}`)
  }
  const result = await handler(request.params.arguments ?? {})
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  }
})

const httpServer = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok" }))
    return
  }

  if (req.url === "/sse") {
    const transport = new SSEServerTransport("/message", res)
    await server.connect(transport)
    return
  }

  res.writeHead(404)
  res.end()
})

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "mcp_shopify_listening")
})
