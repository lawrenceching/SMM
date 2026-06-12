import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  getAppRoot,
  initAppRoot,
  isUsableAppRootForTests,
  resetAppRootForTests,
  resolveAppRootFromScriptForTests,
} from "./paths"

describe("resolveAppRootFromScript", () => {
  it("rejects HarmonyOS-style /main.js argv (dirname would be /)", () => {
    expect(resolveAppRootFromScriptForTests("/main.js")).toBeNull()
  })

  it("resolves a full main script path", () => {
    const script = path.join("/data", "storage", "app", "main.js")
    expect(resolveAppRootFromScriptForTests(script)).toBe(path.dirname(path.resolve(script)))
  })

  it("resolves Windows-style main script paths", () => {
    const script = path.join("C:", "app", "resources", "app", "main.js")
    expect(resolveAppRootFromScriptForTests(script)).toBe(path.dirname(script))
  })
})

describe("isUsableAppRoot", () => {
  it("rejects filesystem root", () => {
    expect(isUsableAppRootForTests("/")).toBe(false)
    expect(isUsableAppRootForTests("C:\\")).toBe(false)
  })
})

describe("initAppRoot", () => {
  afterEach(() => {
    resetAppRootForTests()
  })

  it("stores the resolved app root for getAppRoot", () => {
    const root = path.join(os.tmpdir(), "ohos-app-root")
    initAppRoot(root)
    expect(getAppRoot()).toBe(path.resolve(root))
  })
})
