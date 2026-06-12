import { describe, expect, it } from "vitest"
import {
  activateOhosFileAccessPermission,
  isHarmonyOSPlatform,
  validatePaths,
} from "./file-access-permission"

describe("validatePaths", () => {
  it("accepts non-empty string array", () => {
    expect(validatePaths(["file:///data/docs"], "test")).toEqual(["file:///data/docs"])
  })

  it("throws when paths is not an array", () => {
    expect(() => validatePaths(null, "test")).toThrow(/paths must be an array/)
  })

  it("throws when paths is empty", () => {
    expect(() => validatePaths([], "test")).toThrow(/paths must be non-empty/)
  })

  it("throws when paths contain empty strings", () => {
    expect(() => validatePaths(["file:///data/docs", ""], "test")).toThrow(
      /paths must be non-empty strings/,
    )
  })
})

describe("activateOhosFileAccessPermission", () => {
  it("skips on non-HarmonyOS platforms", () => {
    if (isHarmonyOSPlatform()) {
      return
    }
    expect(activateOhosFileAccessPermission(["file:///data/docs"])).toEqual({
      ok: true,
      skipped: true,
    })
  })
})
