import { getRestClient } from "../handlers/shopify-client.js"

export async function getOrders(args: Record<string, unknown>) {
  const limit = Number(args.limit ?? 10)
  const client = getRestClient()
  const response = await client.get({ path: "orders", query: { limit: String(limit), status: "any" } })
  return response.body
}
