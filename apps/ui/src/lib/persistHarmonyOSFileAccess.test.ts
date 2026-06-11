import { afterEach, describe, expect, it, vi } from "vitest"
import { persistHarmonyOSFileAccess } from "./persistHarmonyOSFileAccess"

vi.mock("./isHarmonyOS", () => ({
  isHarmonyOS: vi.fn(),
}))

import { isHarmonyOS } from "./isHarmonyOS"

describe("persistHarmonyOSFileAccess", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(isHarmonyOS).mockReset()
  })

  it("no-ops when not on HarmonyOS", async () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)
    vi.stubGlobal("window", {})

    await expect(
      persistHarmonyOSFileAccess(["file://docs/storage/folder"]),
    ).resolves.toBeUndefined()
  })

  it("calls electron.fileAccess.persist on HarmonyOS", async () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)
    const persist = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("window", { electron: { fileAccess: { persist } } })

    await persistHarmonyOSFileAccess(["file://docs/storage/folder"])

    expect(persist).toHaveBeenCalledWith(["file://docs/storage/folder"])
  })

  it("throws when persist API is unavailable on HarmonyOS", async () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)
    vi.stubGlobal("window", { electron: {} })

    await expect(
      persistHarmonyOSFileAccess(["file://docs/storage/folder"]),
    ).rejects.toThrow("electron.fileAccess.persist")
  })

  it("throws when persist returns not ok", async () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)
    const persist = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal("window", { electron: { fileAccess: { persist } } })

    await expect(
      persistHarmonyOSFileAccess(["file://docs/storage/folder"]),
    ).rejects.toThrow("无法持久化文件夹访问权限")
  })
})
