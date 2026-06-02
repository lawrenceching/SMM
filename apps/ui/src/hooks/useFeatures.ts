import { useCallback, useEffect, useMemo, useState } from "react"

const VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY = "features.isVideoCaptionerAsrOptionsEnabled"
const TENCENT_ASR_STORAGE_KEY = "features.isTencentAsrTranscribeEnabled"
const MOBILE_LAYOUT_STORAGE_KEY = "features.isMobileLayoutEnabled"

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

/** Default: disabled until the user opts in (`false` when unset). */
function readMobileLayoutEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(MOBILE_LAYOUT_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writeMobileLayoutEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(MOBILE_LAYOUT_STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // ignore
  }
}

/** Default: disabled until the user opts in (`false` when unset). */
function readTencentAsrTranscribeEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(TENCENT_ASR_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writeTencentAsrTranscribeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(TENCENT_ASR_STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // ignore
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
  /**
   * When true, Transcribe entry points stay available without VideoCaptioner, and **Tencent ASR** may be selected in TranscribeDialog.
   * Persisted under `features.isTencentAsrTranscribeEnabled`.
   */
  isTencentAsrTranscribeEnabled: boolean
  setTencentAsrTranscribeEnabled: (enabled: boolean) => void
  /**
   * When true, the mobile-responsive layout (AppNavigation with NavBar/Toolbox) is used
   * instead of the desktop layout (AppV2 with sidebar).
   * Persisted under `features.isMobileLayoutEnabled`.
   * Defaults to false (desktop layout only) until mobile layout is fully implemented.
   */
  isMobileLayoutEnabled: boolean
  setMobileLayoutEnabled: (enabled: boolean) => void
}

export function useFeatures(): UseFeaturesResult {
  const isTranscribeEnabled = useMemo(() => {
    const platform = getRuntimePlatform()
    return platform !== "darwin"
  }, [])

  const [isVideoCaptionerAsrOptionsEnabled, setIsVideoCaptionerAsrOptionsEnabled] = useState(
    readVideoCaptionerAsrOptionsEnabled,
  )

  const [isTencentAsrTranscribeEnabled, setIsTencentAsrTranscribeEnabled] = useState(
    readTencentAsrTranscribeEnabled,
  )

  const [isMobileLayoutEnabled, setIsMobileLayoutEnabled] = useState(
    readMobileLayoutEnabled,
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY) {
        setIsVideoCaptionerAsrOptionsEnabled(readVideoCaptionerAsrOptionsEnabled())
      }
      if (event.key === TENCENT_ASR_STORAGE_KEY) {
        setIsTencentAsrTranscribeEnabled(readTencentAsrTranscribeEnabled())
      }
      if (event.key === MOBILE_LAYOUT_STORAGE_KEY) {
        setIsMobileLayoutEnabled(readMobileLayoutEnabled())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setVideoCaptionerAsrOptionsEnabled = useCallback((enabled: boolean) => {
    writeVideoCaptionerAsrOptionsEnabled(enabled)
    setIsVideoCaptionerAsrOptionsEnabled(enabled)
  }, [])

  const setTencentAsrTranscribeEnabled = useCallback((enabled: boolean) => {
    writeTencentAsrTranscribeEnabled(enabled)
    setIsTencentAsrTranscribeEnabled(enabled)
  }, [])

  const setMobileLayoutEnabled = useCallback((enabled: boolean) => {
    writeMobileLayoutEnabled(enabled)
    setIsMobileLayoutEnabled(enabled)
  }, [])

  return useMemo(
    () => ({
      isTranscribeEnabled,
      isVideoCaptionerAsrOptionsEnabled,
      setVideoCaptionerAsrOptionsEnabled,
      isTencentAsrTranscribeEnabled,
      setTencentAsrTranscribeEnabled,
      isMobileLayoutEnabled,
      setMobileLayoutEnabled,
    }),
    [
      isTranscribeEnabled,
      isVideoCaptionerAsrOptionsEnabled,
      setVideoCaptionerAsrOptionsEnabled,
      isTencentAsrTranscribeEnabled,
      setTencentAsrTranscribeEnabled,
      isMobileLayoutEnabled,
      setMobileLayoutEnabled,
    ],
  )
}
