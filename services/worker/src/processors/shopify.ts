import axios from "axios"
import pino from "pino"

const logger = pino({ name: "processor:shopify" })

export async function executeShopifyWrite(
  actionType: string,
  payload: Record<string, unknown>,
) {
  if (process.env.WRITE_ENABLED !== "true") {
    throw new Error("WRITE_ENABLED is not true — Shopify writes blocked")
  }

  const mcpUrl = process.env.MCP_SHOPIFY_URL ?? "http://localhost:3100"
  const response = await axios.post(`${mcpUrl}/tools/${actionType}`, payload)
  logger.info({ actionType, status: response.status }, "shopify_write_complete")
  return response.data
}
