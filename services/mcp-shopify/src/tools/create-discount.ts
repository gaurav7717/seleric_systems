import { assertWriteEnabled } from "../lib/write-guard.js"

export async function createDiscount(args: Record<string, unknown>) {
  assertWriteEnabled()
  return { code: String(args.code ?? ""), status: "created_stub" }
}
