import { getRestClient } from "../handlers/shopify-client.js"
import { assertWriteEnabled } from "../lib/write-guard.js"

export async function updateProduct(args: Record<string, unknown>) {
  assertWriteEnabled()
  const productId = String(args.product_id ?? "")
  const payload = (args.payload ?? {}) as Record<string, unknown>
  const client = getRestClient()
  const response = await client.put({
    path: `products/${productId}`,
    data: { product: payload },
  })
  return response.body
}
