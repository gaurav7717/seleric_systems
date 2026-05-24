import { createDiscount } from "./create-discount.js"
import { getAnalytics } from "./get-analytics.js"
import { getInventory } from "./get-inventory.js"
import { getOrders } from "./get-orders.js"
import { getProducts } from "./get-products.js"
import { updateProduct } from "./update-product.js"

export const tools = [
  {
    name: "get_products",
    description: "List Shopify products",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_orders",
    description: "List recent Shopify orders",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_inventory",
    description: "Get inventory levels for a product",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" } },
      required: ["product_id"],
    },
  },
  {
    name: "get_analytics",
    description: "Get store analytics summary",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_product",
    description: "Update a Shopify product (WRITE)",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" }, payload: { type: "object" } },
      required: ["product_id", "payload"],
    },
  },
  {
    name: "create_discount",
    description: "Create a discount code (WRITE)",
    inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
  },
]

export const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_products: getProducts,
  get_orders: getOrders,
  get_inventory: getInventory,
  get_analytics: getAnalytics,
  update_product: updateProduct,
  create_discount: createDiscount,
}
