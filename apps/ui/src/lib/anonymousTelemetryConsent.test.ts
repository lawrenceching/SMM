import { describe, it, expect } from "vitest"
import { shouldShowAnonymousTelemetryConsent } from "./anonymousTelemetryConsent"

describe("shouldShowAnonymousTelemetryConsent", () => {
  it("returns true when consent is undefined", () => {
    expect(shouldShowAnonymousTelemetryConsent(undefined)).toBe(true)
  })

  it("returns false when consent is true", () => {
    expect(shouldShowAnonymousTelemetryConsent(true)).toBe(false)
  })

  it("returns false when consent is false", () => {
    expect(shouldShowAnonymousTelemetryConsent(false)).toBe(false)
  })
})
