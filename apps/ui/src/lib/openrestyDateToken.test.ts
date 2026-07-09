import { describe, expect, it } from "vitest"
import { openrestyDateToken } from "./openrestyDateToken"

describe("openrestyDateToken", () => {
  it("formats UTC date as yyyyMMdd", () => {
    expect(openrestyDateToken(new Date("2024-05-07T15:00:00.000Z"))).toBe("20240507")
  })

  it("uses UTC not local calendar day near midnight", () => {
    expect(openrestyDateToken(new Date("2024-05-07T20:00:00.000Z"))).toBe("20240507")
  })
})
