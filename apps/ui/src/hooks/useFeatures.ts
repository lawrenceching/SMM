import { useCallback, useEffect, useMemo, useState } from "react"

const VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY = "features.isVideoCaptionerAsrOptionsEnabled"

/** Default: enabled when the user has never set a preference (`null`). */
function readVideoCaptionerAsrOptionsEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const v = window.localStorage.getItem(VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY)
    if (v === null) return true
    return v === "true"
  } catch {
    return true
  }
}

function writeVideoCaptionerAsrOptionsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY,
      enabled ? "true" : "false",
    )
  } catch {
    // ignore quota / private mode
  }
}

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
  /**
   * When true, UI may expose VideoCaptioner ASR engine selection (e.g. Transcribe dialog).
   * Persisted in localStorage under key `features.isVideoCaptionerAsrOptionsEnabled`.
   * Defaults to enabled until the user explicitly turns it off.
   */
  isVideoCaptionerAsrOptionsEnabled: boolean
  setVideoCaptionerAsrOptionsEnabled: (enabled: boolean) => void
}

export function useFeatures(): UseFeaturesResult {
  const isTranscribeEnabled = useMemo(() => {
    const platform = getRuntimePlatform()
    return platform !== "darwin"
  }, [])

  const [isVideoCaptionerAsrOptionsEnabled, setIsVideoCaptionerAsrOptionsEnabled] = useState(
    readVideoCaptionerAsrOptionsEnabled,
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY) return
      setIsVideoCaptionerAsrOptionsEnabled(readVideoCaptionerAsrOptionsEnabled())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setVideoCaptionerAsrOptionsEnabled = useCallback((enabled: boolean) => {
    writeVideoCaptionerAsrOptionsEnabled(enabled)
    setIsVideoCaptionerAsrOptionsEnabled(enabled)
  }, [])

  return useMemo(
    () => ({
      isTranscribeEnabled,
      isVideoCaptionerAsrOptionsEnabled,
      setVideoCaptionerAsrOptionsEnabled,
    }),
    [isTranscribeEnabled, isVideoCaptionerAsrOptionsEnabled, setVideoCaptionerAsrOptionsEnabled],
  )
}
