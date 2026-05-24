import "@shopify/shopify-api/adapters/node"
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api"

const shop = process.env.SHOPIFY_STORE_DOMAIN ?? ""
const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? ""

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY ?? "placeholder",
  apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "placeholder",
  scopes: ["read_products", "write_products"],
  hostName: shop.replace(".myshopify.com", ""),
  apiVersion: (process.env.SHOPIFY_API_VERSION as typeof LATEST_API_VERSION) ?? LATEST_API_VERSION,
  isEmbeddedApp: false,
})

export function getRestClient() {
  const session = shopify.session.customAppSession(shop)
  session.accessToken = accessToken
  return new shopify.clients.Rest({ session })
}
