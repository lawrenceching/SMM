import { describe, expect, it, vi } from "vitest"
import { APP_VERSION } from "../version"
import { buildHelloConfig } from "./hello-config"

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => `/mock/${name}`,
    getLocale: () => "en-US",
  },
}))

describe("buildHelloConfig", () => {
  it("uses APP_VERSION from build-time version.ts", () => {
    const config = buildHelloConfig(null)
    expect(config.version).toBe(APP_VERSION)
    expect(config.version).not.toBe("1.0.0")
  })
})
