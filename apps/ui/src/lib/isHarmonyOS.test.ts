import { afterEach, describe, expect, it, vi } from "vitest"
import { isHarmonyOS } from "./isHarmonyOS"

describe("isHarmonyOS", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns false when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined)
    expect(isHarmonyOS()).toBe(false)
  })

  it("returns true when appVersion contains OHOS", () => {
    vi.stubGlobal("navigator", { appVersion: "Mozilla/5.0 OHOS 5.0" })
    expect(isHarmonyOS()).toBe(true)
  })

  it("returns true when appVersion contains OpenHarmony", () => {
    vi.stubGlobal("navigator", { appVersion: "Mozilla/5.0 OpenHarmony" })
    expect(isHarmonyOS()).toBe(true)
  })

  it("returns false on desktop user agents", () => {
    vi.stubGlobal("navigator", {
      appVersion: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    })
    expect(isHarmonyOS()).toBe(false)
  })
})
