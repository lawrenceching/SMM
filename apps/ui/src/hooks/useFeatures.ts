import { useMemo } from "react"

/**
 * Best-effort runtime OS detection for renderer (Electron + browser dev).
 * Mirrors patterns used in `@core/path` for Electron vs UA fallback.
 */
function getRuntimePlatform(): string | undefined {
  const proc =
    typeof globalThis !== "undefined" ? (globalThis as { process?: { platform?: string } }).process : undefined
  if (typeof proc?.platform === "string") {
    return proc.platform
  }

  const win =
    typeof globalThis !== "undefined"
      ? (globalThis as { window?: Window & { electron?: { process?: { platform?: string } } } }).window
      : undefined
  const electronPlatform = win?.electron?.process?.platform
  if (typeof electronPlatform === "string") {
    return electronPlatform
  }

  const ua = win?.navigator?.userAgent
  if (ua && /Macintosh|Mac OS X|MacIntel/i.test(ua)) {
    return "darwin"
  }

  return undefined
}

export interface UseFeaturesResult {
  /** Subtitle / transcribe via VideoCaptioner is supported on this OS build. */
  isTranscribeEnabled: boolean
}

export function useFeatures(): UseFeaturesResult {
  return useMemo(() => {
    const platform = getRuntimePlatform()
    return {
      isTranscribeEnabled: platform !== "darwin",
    }
  }, [])
}
