import { getRestClient } from "../handlers/shopify-client.js"

export async function getInventory(args: Record<string, unknown>) {
  const productId = String(args.product_id ?? "")
  const client = getRestClient()
  const response = await client.get({ path: `products/${productId}` })
  return response.body
}
