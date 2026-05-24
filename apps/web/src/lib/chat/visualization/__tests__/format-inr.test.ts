import { describe, expect, it } from "vitest"
import { formatInr, formatRatio } from "../format-inr"

describe("formatInr", () => {
  it("formats crores", () => {
    expect(formatInr(1_86_00_000)).toBe("₹1.86Cr")
  })

  it("formats lakhs", () => {
    expect(formatInr(92_00_000)).toBe("₹92.0L")
  })

  it("formats negative with sign", () => {
    expect(formatInr(-65_60_000, { signed: true })).toBe("-₹65.6L")
  })
})

describe("formatRatio", () => {
  it("formats ratio", () => {
    expect(formatRatio(1.18)).toBe("1.18x")
  })
})
