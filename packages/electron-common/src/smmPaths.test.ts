import os from "os"
import { join } from "path"
import { afterEach, describe, expect, it } from "vitest"
import { getSmmLogDir, getSmmLogFilePath } from "./smmPaths"

const originalPlatform = process.platform
const originalEnv = { ...process.env }

afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform })
  process.env = { ...originalEnv }
})

describe("getSmmLogDir", () => {
  it("uses LOG_DIR when set", () => {
    process.env.LOG_DIR = "/custom/logs"
    expect(getSmmLogDir()).toBe("/custom/logs")
  })

  it("returns Linux default under XDG_DATA_HOME", () => {
    Object.defineProperty(process, "platform", { value: "linux" })
    delete process.env.LOG_DIR
    process.env.XDG_DATA_HOME = "/xdg/data"
    expect(getSmmLogDir()).toBe(join("/xdg/data", "smm", "logs"))
  })

  it("returns Linux fallback under ~/.local/share/smm/logs", () => {
    Object.defineProperty(process, "platform", { value: "linux" })
    delete process.env.LOG_DIR
    delete process.env.XDG_DATA_HOME
    expect(getSmmLogDir()).toBe(join(os.homedir(), ".local", "share", "smm", "logs"))
  })
})

describe("getSmmLogFilePath", () => {
  it("joins smm.log under log dir", () => {
    process.env.LOG_DIR = "/tmp/smm-logs"
    expect(getSmmLogFilePath()).toBe(join("/tmp/smm-logs", "smm.log"))
  })
})
