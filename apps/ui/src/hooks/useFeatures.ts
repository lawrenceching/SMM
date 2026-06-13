import { useCallback, useEffect, useMemo, useState } from "react"

const VIDEOCAPTIONER_ASR_OPTIONS_STORAGE_KEY = "features.isVideoCaptionerAsrOptionsEnabled"
const TENCENT_ASR_STORAGE_KEY = "features.isTencentAsrTranscribeEnabled"
const MOBILE_LAYOUT_STORAGE_KEY = "features.isMobileLayoutEnabled"
const TTY_FOR_YTDLP_STORAGE_KEY = "features.enableTtyForYtdlpCommand"
const PRINT_ARG_FOR_YTDLP_STORAGE_KEY = "features.enablePrintArgInYtdlpCommand"
const DISPLAY_FEATURE_CARDS_IN_WELCOME_STORAGE_KEY = "features.isDisplayFeatureCardsInWelcomeEnabled"
const AI_AREA_STORAGE_KEY = "features.isAiAreaEnabled"
const AI_FEATURE_STORAGE_KEY = "features.isAiFeatureEnabled"
const UI_AI_CHAT_TRANSPORT_STORAGE_KEY = "features.isUIAiChatTransportEnabled"

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

/** Default: disabled — use pipe mode instead of ConPTY. */
function readTtyForYtdlpEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(TTY_FOR_YTDLP_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writeTtyForYtdlpEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(TTY_FOR_YTDLP_STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // ignore
  }
}

/** Default: disabled — progress JSON must stay on stdout for log polling. */
function readPrintArgForYtdlpEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(PRINT_ARG_FOR_YTDLP_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writePrintArgForYtdlpEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PRINT_ARG_FOR_YTDLP_STORAGE_KEY, enabled ? "true" : "false")
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

/** Default: disabled until the user opts in — feature not yet complete. */
function readAiAreaEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(AI_AREA_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writeAiAreaEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AI_AREA_STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // ignore quota / private mode
  }
}

/** Default: enabled when the user has never set a preference (`null`). */
function readAiFeatureEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const v = window.localStorage.getItem(AI_FEATURE_STORAGE_KEY)
    if (v === null) return true
    return v === "true"
  } catch {
    return true
  }
}

function writeAiFeatureEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AI_FEATURE_STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // ignore quota / private mode
  }
}

/** Default: disabled — desktop / Electron build uses the Hono
 * `AssistantChatTransport` by default. Set this to `true` to force
 * the renderer-side `ReverseProxyChatTransport` (the path used by
 * HarmonyOS) on any platform. Useful for testing the in-process
 * transport on desktop without rebuilding for ohos. */
function readUiAiChatTransportEnabled(): boolean {
  return true;
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage.getItem(UI_AI_CHAT_TRANSPORT_STORAGE_KEY)
    if (v === null) return false
    return v === "true"
  } catch {
    return false
  }
}

function writeUiAiChatTransportEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      UI_AI_CHAT_TRANSPORT_STORAGE_KEY,
      enabled ? "true" : "false",
    )
  } catch {
    // ignore quota / private mode
  }
}

/** Default: enabled when the user has never set a preference (`null`). */
function readDisplayFeatureCardsInWelcomeEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const v = window.localStorage.getItem(DISPLAY_FEATURE_CARDS_IN_WELCOME_STORAGE_KEY)
    if (v === null) return true
    return v === "true"
  } catch {
    return true
  }
}

function writeDisplayFeatureCardsInWelcomeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      DISPLAY_FEATURE_CARDS_IN_WELCOME_STORAGE_KEY,
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
  /** Master toggle for all AI features. When false, all AI-related components
   *  (Assistant chat, AI-based recognize/rename prompts, etc.) are hidden.
   *  Defaults to true. Persisted in localStorage under `features.isAiFeatureEnabled`. */
  isAiFeatureEnabled: boolean
  setIsAiFeatureEnabled: (enabled: boolean) => void
  /** When true, the AI Area panel on the right side of the layout is visible.
   *  Defaults to false while the feature is still under development. */
  isAiAreaEnabled: boolean
  setIsAiAreaEnabled: (enabled: boolean) => void
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
  /**
   * When true, yt-dlp commands use ConPTY (`tty: true`) instead of pipe.
   * Defaults to false (pipe mode). Persisted in localStorage.
   */
  enableTtyForYtdlpCommand: boolean
  setEnableTtyForYtdlpCommand: (enabled: boolean) => void
  /**
   * When true, yt-dlp download commands include `--print after_move:filepath`.
   * Defaults to false because --print suppresses progress JSON on stdout,
   * which is needed for log-polling progress display.
   * Persisted in localStorage.
   */
  enablePrintArgInYtdlpCommand: boolean
  setEnablePrintArgInYtdlpCommand: (enabled: boolean) => void
  /**
   * When true, the empty-state welcome view renders feature cards
   * (Import Folder, Download Video, Format Conversion, Github).
   * When false, the original minimal "Simple Media Manager" block is shown.
   * Defaults to true. Persisted under `features.isDisplayFeatureCardsInWelcomeEnabled`.
   */
  isDisplayFeatureCardsInWelcomeEnabled: boolean
  setIsDisplayFeatureCardsInWelcomeEnabled: (enabled: boolean) => void
  /**
   * When true, the AI Assistant uses the in-process
   * `ReverseProxyChatTransport` (renderer-side `streamText` through
   * the backend reverse proxy) instead of the Hono
   * `AssistantChatTransport` (which talks to `POST /api/chat` on the
   * CLI). This is the same transport path that HarmonyOS uses
   * unconditionally.
   *
   * - Defaults to `false` (desktop / Electron build uses the Hono
   *   transport as today).
   * - `Assistant.tsx` combines this flag with `isHarmonyOS()`: when
   *   either is true, the in-process transport is used.
   * - Useful for testing the in-process transport on desktop without
   *   rebuilding for HarmonyOS.
   *
   * Persisted under `features.isUIAiChatTransportEnabled`.
   */
  isUIAiChatTransportEnabled: boolean
  setIsUIAiChatTransportEnabled: (enabled: boolean) => void
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

  const [enableTtyForYtdlpCommand, setTtyForYtdlpCommandState] = useState(
    readTtyForYtdlpEnabled,
  )

  const [enablePrintArgInYtdlpCommand, setPrintArgState] = useState(
    readPrintArgForYtdlpEnabled,
  )

  const [isAiFeatureEnabled, setIsAiFeatureEnabledState] = useState(
    readAiFeatureEnabled,
  )

  const [isAiAreaEnabled, setIsAiAreaEnabled] = useState(
    readAiAreaEnabled,
  )

  const [isDisplayFeatureCardsInWelcomeEnabled, setIsDisplayFeatureCardsInWelcomeEnabled] = useState(
    readDisplayFeatureCardsInWelcomeEnabled,
  )

  const [isUIAiChatTransportEnabled, setIsUIAiChatTransportEnabledState] = useState(
    readUiAiChatTransportEnabled,
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
      if (event.key === TTY_FOR_YTDLP_STORAGE_KEY) {
        setEnableTtyForYtdlpCommand(readTtyForYtdlpEnabled())
      }
      if (event.key === PRINT_ARG_FOR_YTDLP_STORAGE_KEY) {
        setPrintArgState(readPrintArgForYtdlpEnabled())
      }
      if (event.key === AI_FEATURE_STORAGE_KEY) {
        setIsAiFeatureEnabledState(readAiFeatureEnabled())
      }
      if (event.key === AI_AREA_STORAGE_KEY) {
        setIsAiAreaEnabled(readAiAreaEnabled())
      }
      if (event.key === DISPLAY_FEATURE_CARDS_IN_WELCOME_STORAGE_KEY) {
        setIsDisplayFeatureCardsInWelcomeEnabled(readDisplayFeatureCardsInWelcomeEnabled())
      }
      if (event.key === UI_AI_CHAT_TRANSPORT_STORAGE_KEY) {
        setIsUIAiChatTransportEnabledState(readUiAiChatTransportEnabled())
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

  const setEnableTtyForYtdlpCommand = useCallback((enabled: boolean) => {
    writeTtyForYtdlpEnabled(enabled)
    setTtyForYtdlpCommandState(enabled)
  }, [])

  const setEnablePrintArgInYtdlpCommand = useCallback((enabled: boolean) => {
    writePrintArgForYtdlpEnabled(enabled)
    setPrintArgState(enabled)
  }, [])

  const setAiAreaEnabled = useCallback((enabled: boolean) => {
    writeAiAreaEnabled(enabled)
    setIsAiAreaEnabled(enabled)
  }, [])

  const setIsAiFeatureEnabled = useCallback((enabled: boolean) => {
    writeAiFeatureEnabled(enabled)
    setIsAiFeatureEnabledState(enabled)
  }, [])

  const setIsDisplayFeatureCardsInWelcomeEnabledCallback = useCallback((enabled: boolean) => {
    writeDisplayFeatureCardsInWelcomeEnabled(enabled)
    setIsDisplayFeatureCardsInWelcomeEnabled(enabled)
  }, [])

  const setIsUIAiChatTransportEnabled = useCallback((enabled: boolean) => {
    writeUiAiChatTransportEnabled(enabled)
    setIsUIAiChatTransportEnabledState(enabled)
  }, [])

  return useMemo(
    () => ({
      isAiFeatureEnabled,
      setIsAiFeatureEnabled,
      isTranscribeEnabled,
      isVideoCaptionerAsrOptionsEnabled,
      setVideoCaptionerAsrOptionsEnabled,
      isTencentAsrTranscribeEnabled,
      setTencentAsrTranscribeEnabled,
      isMobileLayoutEnabled,
      setMobileLayoutEnabled,
      enableTtyForYtdlpCommand,
      setEnableTtyForYtdlpCommand,
      enablePrintArgInYtdlpCommand,
      setEnablePrintArgInYtdlpCommand,
      isAiAreaEnabled,
      setIsAiAreaEnabled: setAiAreaEnabled,
      isDisplayFeatureCardsInWelcomeEnabled,
      setIsDisplayFeatureCardsInWelcomeEnabled: setIsDisplayFeatureCardsInWelcomeEnabledCallback,
      isUIAiChatTransportEnabled,
      setIsUIAiChatTransportEnabled,
    }),
    [
      isAiFeatureEnabled,
      setIsAiFeatureEnabled,
      isTranscribeEnabled,
      isVideoCaptionerAsrOptionsEnabled,
      setVideoCaptionerAsrOptionsEnabled,
      isTencentAsrTranscribeEnabled,
      setTencentAsrTranscribeEnabled,
      isMobileLayoutEnabled,
      setMobileLayoutEnabled,
      enableTtyForYtdlpCommand,
      setEnableTtyForYtdlpCommand,
      enablePrintArgInYtdlpCommand,
      setEnablePrintArgInYtdlpCommand,
      isAiAreaEnabled,
      setAiAreaEnabled,
      isDisplayFeatureCardsInWelcomeEnabled,
      setIsDisplayFeatureCardsInWelcomeEnabledCallback,
      isUIAiChatTransportEnabled,
      setIsUIAiChatTransportEnabled,
    ],
  )
}
