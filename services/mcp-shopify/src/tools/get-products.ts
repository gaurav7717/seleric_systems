import { getRestClient } from "../handlers/shopify-client.js"

export async function getProducts(args: Record<string, unknown>) {
  const limit = Number(args.limit ?? 10)
  const client = getRestClient()
  const response = await client.get({ path: "products", query: { limit: String(limit) } })
  return response.body
}
