import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

vi.mock("@/lib/isHarmonyOS", () => ({
  isHarmonyOS: vi.fn(),
}))

import { isHarmonyOS } from "@/lib/isHarmonyOS"
import { useFeatures } from "./useFeatures"

describe("useFeatures HarmonyOS gating", () => {
  beforeEach(() => {
    vi.mocked(isHarmonyOS).mockReset()
    localStorage.clear()
  })

  it("enables subtitle, download, format converter, and video compression on non-HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)

    const { result } = renderHook(() => useFeatures())

    expect(result.current.isSubtitleFeaturesEnabled).toBe(true)
    expect(result.current.isDownloadVideoEnabled).toBe(true)
    expect(result.current.isFormatConverterEnabled).toBe(true)
    expect(result.current.isVideoCompressionEnabled).toBe(true)
  })

  it("disables subtitle, download, format converter, and video compression on HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)

    const { result } = renderHook(() => useFeatures())

    expect(result.current.isSubtitleFeaturesEnabled).toBe(false)
    expect(result.current.isDownloadVideoEnabled).toBe(false)
    expect(result.current.isFormatConverterEnabled).toBe(false)
    expect(result.current.isVideoCompressionEnabled).toBe(false)
    expect(result.current.isTranscribeEnabled).toBe(false)
  })
})
