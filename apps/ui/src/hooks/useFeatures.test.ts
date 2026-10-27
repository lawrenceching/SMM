import { describe, it, expect, vi, beforeEach } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HelloFeatures } from "@smm/types"
import { helloQueryKey } from "@/lib/appQueryKeys"

vi.mock("@/lib/isHarmonyOS", () => ({
  isHarmonyOS: vi.fn(),
}))

import { isHarmonyOS } from "@/lib/isHarmonyOS"
import { useFeatures } from "./useFeatures"

function wrapperWithFeatures(features?: HelloFeatures) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  if (features) {
    queryClient.setQueryData(helloQueryKey, { features })
  }
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useFeatures HarmonyOS gating", () => {
  beforeEach(() => {
    vi.mocked(isHarmonyOS).mockReset()
    localStorage.clear()
  })

  it("keeps format converter on and hides yt-dlp and VideoCaptioner before hello", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)

    const { result } = renderHook(() => useFeatures(), {
      wrapper: wrapperWithFeatures(),
    })

    expect(result.current.isSubtitleFeaturesEnabled).toBe(false)
    expect(result.current.isDownloadVideoEnabled).toBe(false)
    expect(result.current.isTranscribeEnabled).toBe(false)
    expect(result.current.isFormatConverterEnabled).toBe(true)
    expect(result.current.isVideoCompressionEnabled).toBe(true)
    expect(result.current.isMusicFolderImportEnabled).toBe(true)
  })

  it("enables yt-dlp and VideoCaptioner when hello features are true", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)

    const { result } = renderHook(() => useFeatures(), {
      wrapper: wrapperWithFeatures({ ytdlp: true, videocaptioner: true }),
    })

    expect(result.current.isDownloadVideoEnabled).toBe(true)
    expect(result.current.isSubtitleFeaturesEnabled).toBe(true)
    const macUa = /Macintosh|Mac OS X|MacIntel/i.test(window.navigator.userAgent)
    expect(result.current.isTranscribeEnabled).toBe(!macUa)
  })

  it("hides yt-dlp and VideoCaptioner when hello features are false", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)

    const { result } = renderHook(() => useFeatures(), {
      wrapper: wrapperWithFeatures({ ytdlp: false, videocaptioner: false }),
    })

    expect(result.current.isDownloadVideoEnabled).toBe(false)
    expect(result.current.isSubtitleFeaturesEnabled).toBe(false)
    expect(result.current.isTranscribeEnabled).toBe(false)
    expect(result.current.isFormatConverterEnabled).toBe(true)
  })

  it("keeps yt-dlp and VideoCaptioner hidden on HarmonyOS even when hello enables them", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)

    const { result } = renderHook(() => useFeatures(), {
      wrapper: wrapperWithFeatures({ ytdlp: true, videocaptioner: true }),
    })

    expect(result.current.isDownloadVideoEnabled).toBe(false)
    expect(result.current.isSubtitleFeaturesEnabled).toBe(false)
    expect(result.current.isTranscribeEnabled).toBe(false)
  })

  it("disables subtitle, download, format converter, and video compression on HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)

    const { result } = renderHook(() => useFeatures(), {
      wrapper: wrapperWithFeatures(),
    })

    expect(result.current.isSubtitleFeaturesEnabled).toBe(false)
    expect(result.current.isDownloadVideoEnabled).toBe(false)
    expect(result.current.isFormatConverterEnabled).toBe(false)
    expect(result.current.isVideoCompressionEnabled).toBe(false)
    expect(result.current.isMusicFolderImportEnabled).toBe(false)
    expect(result.current.isTranscribeEnabled).toBe(false)
  })

  it("defaults isAiFeatureEnabled to true on non-HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)

    const { result } = renderHook(() => useFeatures(), { wrapper: wrapperWithFeatures() })

    expect(result.current.isAiFeatureEnabled).toBe(true)
  })

  it("defaults isAiFeatureEnabled to false on HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)

    const { result } = renderHook(() => useFeatures(), { wrapper: wrapperWithFeatures() })

    expect(result.current.isAiFeatureEnabled).toBe(false)
  })

  it("preserves explicit user preference over HarmonyOS default", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(true)
    localStorage.setItem("features.isAiFeatureEnabled", "true")

    const { result } = renderHook(() => useFeatures(), { wrapper: wrapperWithFeatures() })

    expect(result.current.isAiFeatureEnabled).toBe(true)
  })

  it("preserves explicit user preference (false) on non-HarmonyOS", () => {
    vi.mocked(isHarmonyOS).mockReturnValue(false)
    localStorage.setItem("features.isAiFeatureEnabled", "false")

    const { result } = renderHook(() => useFeatures(), { wrapper: wrapperWithFeatures() })

    expect(result.current.isAiFeatureEnabled).toBe(false)
  })
})
