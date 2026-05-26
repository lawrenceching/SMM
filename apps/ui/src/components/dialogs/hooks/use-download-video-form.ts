import { useState, useCallback, useEffect, useMemo } from "react"
import { validateDownloadUrl } from "@core/download-video-validators"
import { isBilibiliCollectionUrl } from "@/api/ytdlp"
import { useListFormatsMutation } from "./useListFormatsMutation"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useDialogs } from "@/providers/dialog-provider"
import { useConfig } from "@/hooks/userConfig/useConfig"
import {
  writeYtdlpCookiesFile,
  buildYtdlpCookiesFilePath,
  deleteYtdlpCookiesFile,
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
import { fetchDiscoverExecutables } from "@/api/discoverExecutables"

const LOCAL_STORAGE_KEY = "DownloadVideoDialog.userAgreed"

function isBilibiliUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    return host === "b23.tv" || host.endsWith(".bilibili.com") || host === "bilibili.com"
  } catch {
    return false
  }
}

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
  isCollectionUrl: boolean
  canDownloadEpisodes: boolean
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

  // New: QuickJS availability
  quickjsUnavailable: boolean

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

  handleUrlChange: (value: string) => void
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
  const { formatsResult, isListing, listingError, listFormats, reset: resetListFormats } =
    useListFormatsMutation()
  const { appConfig } = useConfig()

  // --- platform ---
  const platform = useMemo(() => {
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      return /windows/i.test(navigator.userAgent) ? "win32" : process.platform
    }
    return process.platform
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
  const [quickjsUnavailable, setQuickjsUnavailable] = useState(false)

  // --- destinationFolder sync ---
  useEffect(() => {
    if (isOpen && destinationFolder) {
      setDownloadFolder(destinationFolder)
    }
  }, [isOpen, destinationFolder])

  // --- derived state ---
  const isUrlValid = url.trim() !== "" && validateDownloadUrl(url.trim()).valid
  const isCollectionUrl = isBilibiliCollectionUrl(url.trim()) && isUrlValid
  const canDownloadEpisodes = isBilibiliUrl(url) && !isCollectionUrl
  const isYoutube = isYoutubeUrl(url)

  // Formats have been fetched successfully
  const showCookiesAtTopLevel = !formatsResult

  // Format codes from the listing
  const formatCodes = formatsResult?.formatCodes ?? []

  // Go button is disabled for YouTube without cookies, or when Use cookies is checked but text is empty, or QuickJS unavailable
  const goDisabled =
    quickjsUnavailable ||
    (isYoutube
      ? (!useCookies && !useCookiesFromBrowser) || (useCookies && !cookiesText.trim())
      : useCookies && !cookiesText.trim())

  const resolvedYtdlpFormat = resolveYtdlpFormat({
    formatMode,
    selectedFormatCode,
    selectedSupplementaryFormatCode,
    selectedFormatPresetId,
  })

  const is1080pAvailable =
    availableHeights === null ? true : availableHeights.includes(1080)

  const has1080pAuth =
    (useCookies && cookiesText.trim().length > 0) || useCookiesFromBrowser

  const start1080pBlocked =
    selectedFormatPresetId === "1080p" && !is1080pAvailable && !has1080pAuth

  const resolvedYtdlpExtraArgs = showMoreOptions
    ? buildYtdlpExtraArgsFromSelection(extraArgSelection)
    : undefined

  // --- Sync availableHeights when formatsResult changes ---
  useEffect(() => {
    if (formatsResult) {
      setAvailableHeights(formatsResult.availableHeights)
    }
  }, [formatsResult])

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
        } else {
          // Switching to a different domain with no cached cookies — reset
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
    if (isYoutubeUrl(trimmed)) {
      try {
        const { quickjs } = await fetchDiscoverExecutables()
        const found = !!(quickjs.configuredPath || quickjs.discoveredPath)
        setQuickjsUnavailable(!found)
        if (!found) {
          return
        }
      } catch {
        setQuickjsUnavailable(true)
        return
      }
    }

    const cfBrowser = useCookiesFromBrowser ? cookiesBrowser : undefined

    // Write manual cookies to a temp file if enabled
    let cookiesFile: string | undefined
    if (useCookies && cookiesText.trim()) {
      const userDataDir = appConfig.userDataDir
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
        ...(useJsRuntime ? { jsRuntime } : {}),
      },
      cookiesFile
        ? () => {
            deleteYtdlpCookiesFile(cookiesFile)
          }
        : undefined,
    )
  }, [url, useCookiesFromBrowser, cookiesBrowser, useJsRuntime, jsRuntime, useCookies, cookiesText, appConfig.userDataDir, listFormats, runUrlValidation])

  const handleAgreementChange = useCallback(
    (checked: boolean) => {
      setIsAgreementChecked(checked)
      if (checked) {
        setHasAgreed(true)
      }
    },
    [setHasAgreed],
  )

  const handleOpenCookiesEditor = useCallback(() => {
    openTextDialog((text: string) => setCookiesText(text), {
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
    setQuickjsUnavailable(false)
    resetListFormats()
  }, [platform, resetListFormats])

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
    isCollectionUrl,
    canDownloadEpisodes,
    is1080pAvailable,
    has1080pAuth,
    start1080pBlocked,
    resolvedYtdlpFormat,
    resolvedYtdlpExtraArgs,

    // New
    isListingFormats: isListing,
    listingError,
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
    quickjsUnavailable,

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

    handleUrlChange,
    handleGo,
    handleAgreementChange,
    handleOpenCookiesEditor,

    resetFormState,
  }
}
