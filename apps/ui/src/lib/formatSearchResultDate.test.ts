import { describe, expect, it } from "vitest"
import { formatSearchResultDate } from "./formatSearchResultDate"

describe("formatSearchResultDate", () => {
  it("formats a date-only TMDB string without shifting the calendar day", () => {
    expect(formatSearchResultDate("2023-04-12")).toBe("April 12, 2023")
  })

  it("formats an ISO datetime using its UTC calendar date", () => {
    expect(formatSearchResultDate("2023-04-12T00:00:00.000Z")).toBe("April 12, 2023")
  })

  it("leaves non-dates unchanged", () => {
    expect(formatSearchResultDate("2023")).toBe("2023")
    expect(formatSearchResultDate("")).toBe("")
  })
})
