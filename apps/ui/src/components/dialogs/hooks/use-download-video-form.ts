import { useState, useCallback, useEffect, useMemo } from "react"
import { validateDownloadUrl } from "@core/download-video-validators"
import { useListFormatsMutation } from "./useListFormatsMutation"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useDialogs } from "@/providers/dialog-provider"
import { useConfig } from "@/hooks/userConfig/useConfig"
import {
  writeYtdlpCookiesFile,
  buildYtdlpCookiesFilePath,
} from "@/lib/ytdlpCookiesFile"
import {
  getCookiesBrowserIds,
  type YtdlpCookiesBrowserId,
} from "@/lib/ytdlpCookiesBrowsers"
import {
  getCachedCookies,
  setCachedCookies,
  extractHostname,
} from "@/lib/ytdlpCookiesCache"
import {
  buildYtdlpExtraArgsFromSelection,
  DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION,
  type YtdlpDownloadExtraArgId,
  type YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"
import {
  resolveYtdlpFormat,
  type YtdlpFormatMode,
  type YtdlpFormatPresetId,
} from "@/lib/ytdlpFormatPresets"
import {
  DEFAULT_YTDLP_JS_RUNTIME_ID,
  type YtdlpJsRuntimeId,
} from "@/lib/ytdlpJsRuntimes"
import type { YtdlpFormatCodeEntry } from "@/lib/ytdlpFormatCodes"
import {
  buildFormatCodes,
  extractAvailableHeights,
  is1080pAvailableFromFormats,
} from "@/lib/ytdlpFormatCodes"
import { fetchDiscoverExecutables } from "@/api/discoverExecutables"
import type { VideoMetadata } from "@/api/ytdlp/types"
import { isYoutubeDownloadUrl } from "@core/download-video-cookie-platform"

const LOCAL_STORAGE_KEY = "DownloadVideoDialog.userAgreed"


function isYoutubeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be"
  } catch {
    return false
  }
}

export interface UseDownloadVideoFormOptions {
  isOpen: boolean
  destinationFolder?: string
  t: (key: string) => string
}

export interface UseDownloadVideoFormReturn {
  url: string
  downloadFolder: string
  urlError: string | null

  hasAgreed: boolean
  isAgreementChecked: boolean

  selectedFormatPresetId: YtdlpFormatPresetId
  availableHeights: number[] | null

  cookiesText: string
  useCookies: boolean
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId

  showMoreOptions: boolean
  extraArgSelection: YtdlpDownloadExtraArgSelection

  isUrlValid: boolean
  is1080pAvailable: boolean
  has1080pAuth: boolean
  start1080pBlocked: boolean
  resolvedYtdlpFormat: string | undefined
  resolvedYtdlpExtraArgs: string[] | undefined

  // New: format listing
  isListingFormats: boolean
  listingError: string | null
  formatCodes: YtdlpFormatCodeEntry[]
  goDisabled: boolean

  // New: platform & YouTube detection
  platform: string
  isYoutube: boolean

  // New: cookies visibility
  showCookiesAtTopLevel: boolean

  // New: format mode
  formatMode: YtdlpFormatMode
  selectedFormatCode: string
  selectedSupplementaryFormatCode: string

  // New: JS runtime
  useJsRuntime: boolean
  jsRuntime: YtdlpJsRuntimeId
  /** Bundled QuickJS path from discover probe (YouTube Go). */
  jsRuntimePath: string | undefined

  // New: proxy
  proxy: string

  // New: video list entries from playlist
  listingExecutionId: string | null
  videoListEntries: VideoMetadata[] | null

  // New: QuickJS availability
  quickjsUnavailable: boolean

  /** YouTube cookies hint: persistent red after URL blur without cookies. */
  youtubeCookiesHintEmphasized: boolean
  /** Incremented on each YouTube URL blur to replay the 3-pulse flash animation. */
  youtubeCookiesHintFlashKey: number

  setDownloadFolder: (v: string) => void
  setSelectedFormatPresetId: (id: YtdlpFormatPresetId) => void
  setCookiesText: (text: string) => void
  setUseCookies: (v: boolean) => void
  setUseCookiesFromBrowser: (v: boolean) => void
  setCookiesBrowser: (id: YtdlpCookiesBrowserId) => void
  setShowMoreOptions: (v: boolean) => void
  setExtraArgEnabled: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void

  // New: format mode setters
  setFormatMode: (mode: YtdlpFormatMode) => void
  setSelectedFormatCode: (id: string) => void
  setSelectedSupplementaryFormatCode: (id: string) => void

  // New: JS runtime setters
  setUseJsRuntime: (v: boolean) => void
  setJsRuntime: (id: YtdlpJsRuntimeId) => void

  // New: proxy setter
  setProxy: (v: string) => void

  handleUrlChange: (value: string) => void
  handleUrlBlur: () => void
  handleGo: () => void
  handleAgreementChange: (checked: boolean) => void
  handleOpenCookiesEditor: () => void

  resetFormState: () => void
}

export function useDownloadVideoForm(
  opts: UseDownloadVideoFormOptions,
): UseDownloadVideoFormReturn {
  const { isOpen, destinationFolder, t } = opts

  const { textDialog: [openTextDialog] } = useDialogs()
  const { videoMetadata, videoListEntries, isListing, listingError, listingExecutionId, listFormats, reset: resetListFormats } =
    useListFormatsMutation()
  const { appConfig, userConfig, setAndSaveUserConfig } = useConfig()

  // --- platform ---
  const platform = useMemo(() => {
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      if (/windows/i.test(navigator.userAgent)) return "win32"
      if (/mac/i.test(navigator.userAgent)) return "darwin"
      return "linux"
    }
    return "linux"
  }, [])

  // --- persisted agreement ---
  const [hasAgreed, setHasAgreed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEY, false)
  const [isAgreementChecked, setIsAgreementChecked] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setIsAgreementChecked(hasAgreed)
  }, [isOpen, hasAgreed])

  // --- form fields ---
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [selectedFormatPresetId, setSelectedFormatPresetId] =
    useState<YtdlpFormatPresetId>("default")
  const [cookiesText, setCookiesText] = useState("")
  const [useCookies, setUseCookies] = useState(false)
  const [useCookiesFromBrowser, setUseCookiesFromBrowser] = useState(false)
  const [cookiesBrowser, setCookiesBrowser] = useState<YtdlpCookiesBrowserId>(() => {
    const ids = getCookiesBrowserIds(platform)
    return ids.includes("firefox") ? "firefox" : ids[0]
  })
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [extraArgSelection, setExtraArgSelection] = useState<YtdlpDownloadExtraArgSelection>(
    () => ({ ...DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION }),
  )
  const [availableHeights, setAvailableHeights] = useState<number[] | null>(null)
  const [formatMode, setFormatMode] = useState<YtdlpFormatMode>("preset")
  const [selectedFormatCode, setSelectedFormatCode] = useState("")
  const [selectedSupplementaryFormatCode, setSelectedSupplementaryFormatCode] = useState("")
  const [useJsRuntime, setUseJsRuntime] = useState(false)
  const [jsRuntime, setJsRuntime] = useState<YtdlpJsRuntimeId>(DEFAULT_YTDLP_JS_RUNTIME_ID)
  const [jsRuntimePath, setJsRuntimePath] = useState<string | undefined>(undefined)
  const [quickjsUnavailable, setQuickjsUnavailable] = useState(false)
  const [proxy, setProxyState] = useState<string>(() => userConfig?.ytdlpProxy ?? "")
  const [youtubeCookiesHintEmphasized, setYoutubeCookiesHintEmphasized] = useState(false)
  const [youtubeCookiesHintFlashKey, setYoutubeCookiesHintFlashKey] = useState(0)

  // --- destinationFolder sync ---
  useEffect(() => {
    if (isOpen && destinationFolder) {
      setDownloadFolder(destinationFolder)
    }
  }, [isOpen, destinationFolder])

  // --- derived state ---
  const isUrlValid = url.trim() !== "" && validateDownloadUrl(url.trim()).valid
  const isYoutube = isYoutubeUrl(url)
  const hasYoutubeCookiesAuth = useCookies || useCookiesFromBrowser

  useEffect(() => {
    if (!isYoutube || hasYoutubeCookiesAuth) {
      setYoutubeCookiesHintEmphasized(false)
      setYoutubeCookiesHintFlashKey(0)
    }
  }, [isYoutube, hasYoutubeCookiesAuth])

  // Formats have been fetched successfully
  const showCookiesAtTopLevel = !videoMetadata

  // Format codes from the listing
  const formatCodes = buildFormatCodes(videoMetadata?.formats ?? [])

  // Go button is disabled for YouTube without cookies, or when Use cookies is checked but text is empty
  const goDisabled =
    (isYoutube
      ? (!useCookies && !useCookiesFromBrowser) || (useCookies && !cookiesText.trim())
      : useCookies && !cookiesText.trim())

  const resolvedYtdlpFormat = resolveYtdlpFormat({
    formatMode,
    selectedFormatCode,
    selectedSupplementaryFormatCode,
    selectedFormatPresetId,
  })

  const is1080pAvailable = videoMetadata
    ? is1080pAvailableFromFormats(videoMetadata.formats)
    : true

  const has1080pAuth =
    (useCookies && cookiesText.trim().length > 0) || useCookiesFromBrowser

  const start1080pBlocked =
    selectedFormatPresetId === "1080p" && !is1080pAvailable && !has1080pAuth

  const resolvedYtdlpExtraArgs = showMoreOptions
    ? buildYtdlpExtraArgsFromSelection(extraArgSelection)
    : undefined

  // --- Sync availableHeights when videoMetadata changes ---
  useEffect(() => {
    if (videoMetadata) {
      setAvailableHeights(extractAvailableHeights(videoMetadata.formats))
    }
  }, [videoMetadata])

  // --- Force JS Runtime for YouTube ---
  useEffect(() => {
    if (isYoutube) {
      setUseJsRuntime(true)
    }
  }, [isYoutube])

  const runUrlValidation = useCallback(
    (value: string) => {
      const result = validateDownloadUrl(value)
      if (!result.valid) {
        setUrlError(
          t(`downloadVideo.validation.${result.error}` as "downloadVideo.validation.URL_EMPTY"),
        )
      } else {
        setUrlError(null)
      }
    },
    [t],
  )

  // --- handlers ---
  const handleUrlChange = useCallback(
    (value: string) => {
      setUrl(value)
      setQuickjsUnavailable(false)
      setJsRuntimePath(undefined)
      // Reset format listing when URL changes so cookies move back to top level
      if (value.trim() !== url.trim()) {
        resetListFormats()
      }
      // Pre-fill cookies from cache for the new URL's domain
      const hostname = extractHostname(value.trim())
      const prevHostname = extractHostname(url.trim())
      if (hostname && hostname !== prevHostname) {
        const cached = getCachedCookies(hostname)
        if (cached) {
          setCookiesText(cached.cookiesText)
          setUseCookies(cached.useCookies)
          setUseCookiesFromBrowser(cached.useCookiesFromBrowser)
          setCookiesBrowser(cached.cookiesBrowser)
        } else if (prevHostname) {
          // Switching from a known domain to a different one with no cached cookies — reset
          setCookiesText("")
          setUseCookies(false)
          setUseCookiesFromBrowser(false)
          setCookiesBrowser(
            getCookiesBrowserIds(platform).includes("firefox") ? "firefox" : getCookiesBrowserIds(platform)[0],
          )
        }
      }
      const result = validateDownloadUrl(value.trim())
      if (!result.valid) {
        setAvailableHeights(null)
        if (value.trim().length > 0) {
          setUrlError(
            t(`downloadVideo.validation.${result.error}` as "downloadVideo.validation.URL_EMPTY"),
          )
        } else {
          setUrlError(null)
        }
      } else {
        setUrlError(null)
      }
    },
    [t, url, platform, resetListFormats],
  )

  const handleGo = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed || !validateDownloadUrl(trimmed).valid) {
      runUrlValidation(trimmed)
      return
    }

    // For YouTube URLs, check QuickJS availability before listing formats
    let quickjsPath: string | undefined
    if (isYoutubeUrl(trimmed)) {
      try {
        const { quickjs } = await fetchDiscoverExecutables()
        quickjsPath = quickjs.configuredPath || quickjs.discoveredPath || undefined
        const found = !!quickjsPath
        setQuickjsUnavailable(!found)
        setJsRuntimePath(quickjsPath)
        if (!found) {
          return
        }
      } catch {
        setQuickjsUnavailable(true)
        setJsRuntimePath(undefined)
        return
      }
    } else {
      setJsRuntimePath(undefined)
    }

    const cfBrowser = useCookiesFromBrowser ? cookiesBrowser : undefined
    const userDataDir = appConfig.userDataDir

    // Write manual cookies to a temp file if enabled
    let cookiesFile: string | undefined
    if (useCookies && cookiesText.trim()) {
      if (userDataDir) {
        try {
          const tempId = `list-formats-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          const filePath = buildYtdlpCookiesFilePath(userDataDir, tempId)
          cookiesFile = await writeYtdlpCookiesFile(userDataDir, tempId, cookiesText)
          if (!cookiesFile) cookiesFile = filePath
        } catch {
          // If writing fails, proceed without the cookies file
        }
      }
    }

    // Cache cookies for this domain
    const hostname = extractHostname(trimmed)
    if (hostname) {
      setCachedCookies(hostname, {
        cookiesText,
        useCookies,
        useCookiesFromBrowser,
        cookiesBrowser,
      })
    }

    listFormats(
      {
        url: trimmed,
        cookiesFromBrowser: cfBrowser,
        ...(cookiesFile ? { cookiesFile } : {}),
        ...(useJsRuntime ? { jsRuntime, jsRuntimePath: quickjsPath } : {}),
        ...(proxy.trim() ? { proxy: proxy.trim() } : {}),
        ...(userDataDir ? { userDataDir } : {}),
      },
    )
  }, [url, useCookiesFromBrowser, cookiesBrowser, useJsRuntime, jsRuntime, useCookies, cookiesText, appConfig.userDataDir, listFormats, runUrlValidation, proxy])

  const handleAgreementChange = useCallback(
    (checked: boolean) => {
      setIsAgreementChecked(checked)
      if (checked) {
        setHasAgreed(true)
      }
    },
    [setHasAgreed],
  )

  const handleUrlBlur = useCallback(() => {
    const trimmed = url.trim()
    if (!isYoutubeDownloadUrl(trimmed)) {
      return
    }
    if (useCookies || useCookiesFromBrowser) {
      return
    }
    setYoutubeCookiesHintEmphasized(true)
    setYoutubeCookiesHintFlashKey((key) => key + 1)
  }, [url, useCookies, useCookiesFromBrowser])

  const handleOpenCookiesEditor = useCallback(() => {
    openTextDialog((text: string) => {
      setCookiesText(text)
      if (text.trim()) {
        setUseCookies(true)
      }
    }, {
      initialValue: cookiesText,
      title: t("downloadVideo.cookiesDialogTitle"),
      description: t("downloadVideo.cookiesDialogDescription"),
      label: t("downloadVideo.cookiesDialogLabel"),
    })
  }, [openTextDialog, cookiesText, t])

  const setExtraArgEnabled = useCallback(
    (id: YtdlpDownloadExtraArgId, enabled: boolean) => {
      setExtraArgSelection((prev) => ({ ...prev, [id]: enabled }))
    },
    [],
  )

  const setProxy = useCallback(
    async (value: string) => {
      setProxyState(value)
      const trimmed = value.trim()
      if (trimmed === (userConfig?.ytdlpProxy ?? "")) {
        return
      }
      try {
        await setAndSaveUserConfig(
          `dvd-proxy-${Date.now()}`,
          { ...userConfig, ytdlpProxy: trimmed },
        )
      } catch (error) {
        console.error("[useDownloadVideoForm] Failed to persist proxy:", error)
      }
    },
    [setAndSaveUserConfig, userConfig],
  )

  // --- reset ---
  const resetFormState = useCallback(() => {
    setUrl("")
    setDownloadFolder("")
    setUrlError(null)
    setSelectedFormatPresetId("default")
    setCookiesText("")
    setUseCookies(false)
    setUseCookiesFromBrowser(false)
    setCookiesBrowser(() => {
      const ids = getCookiesBrowserIds(platform)
      return ids.includes("firefox") ? "firefox" : ids[0]
    })
    setShowMoreOptions(false)
    setExtraArgSelection({ ...DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION })
    setAvailableHeights(null)
    setFormatMode("preset")
    setSelectedFormatCode("")
    setSelectedSupplementaryFormatCode("")
    setUseJsRuntime(false)
    setJsRuntime(DEFAULT_YTDLP_JS_RUNTIME_ID)
    setJsRuntimePath(undefined)
    setQuickjsUnavailable(false)
    setYoutubeCookiesHintEmphasized(false)
    setYoutubeCookiesHintFlashKey(0)
    setProxy(userConfig?.ytdlpProxy ?? "")
    resetListFormats()
  }, [platform, resetListFormats, userConfig?.ytdlpProxy])

  return {
    url,
    downloadFolder,
    urlError,

    hasAgreed,
    isAgreementChecked,

    selectedFormatPresetId,
    availableHeights,

    cookiesText,
    useCookies,
    useCookiesFromBrowser,
    cookiesBrowser,

    showMoreOptions,
    extraArgSelection,

    isUrlValid,

    is1080pAvailable,
    has1080pAuth,
    start1080pBlocked,
    resolvedYtdlpFormat,
    resolvedYtdlpExtraArgs,

    // New
    videoListEntries,
    isListingFormats: isListing,
    listingError,
    listingExecutionId,
    formatCodes,
    goDisabled,
    platform,
    isYoutube,
    showCookiesAtTopLevel,
    formatMode,
    selectedFormatCode,
    selectedSupplementaryFormatCode,
    useJsRuntime,
    jsRuntime,
    jsRuntimePath,
    quickjsUnavailable,
    youtubeCookiesHintEmphasized,
    youtubeCookiesHintFlashKey,
    proxy,

    setDownloadFolder,
    setSelectedFormatPresetId,
    setCookiesText,
    setUseCookies,
    setUseCookiesFromBrowser,
    setCookiesBrowser,
    setShowMoreOptions,
    setExtraArgEnabled,
    setFormatMode,
    setSelectedFormatCode,
    setSelectedSupplementaryFormatCode,
    setUseJsRuntime,
    setJsRuntime,
    setProxy,

    handleUrlChange,
    handleUrlBlur,
    handleGo,
    handleAgreementChange,
    handleOpenCookiesEditor,

    resetFormState,
  }
}
