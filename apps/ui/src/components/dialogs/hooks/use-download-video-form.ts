import { useState, useCallback, useEffect, useRef } from "react"
import { validateDownloadUrl } from "@core/download-video-validators"
import { isBilibiliCollectionUrl } from "@/api/ytdlp"
import { useListYtdlpFormatsMutation } from "@/hooks/ytdlp/useYtdlpMutations"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useDialogs } from "@/providers/dialog-provider"
import {
  DEFAULT_YTDLP_COOKIES_BROWSER_ID,
  type YtdlpCookiesBrowserId,
} from "@/lib/ytdlpCookiesBrowsers"
import {
  buildYtdlpExtraArgsFromSelection,
  DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION,
  type YtdlpDownloadExtraArgId,
  type YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"
import {
  resolveYtdlpFormatFromPreset,
  type YtdlpFormatPresetId,
} from "@/lib/ytdlpFormatPresets"

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

  setDownloadFolder: (v: string) => void
  setSelectedFormatPresetId: (id: YtdlpFormatPresetId) => void
  setCookiesText: (text: string) => void
  setUseCookies: (v: boolean) => void
  setUseCookiesFromBrowser: (v: boolean) => void
  setCookiesBrowser: (id: YtdlpCookiesBrowserId) => void
  setShowMoreOptions: (v: boolean) => void
  setExtraArgEnabled: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void

  handleUrlChange: (value: string) => void
  handleUrlBlur: () => void
  handleAgreementChange: (checked: boolean) => void
  handleOpenCookiesEditor: () => void

  resetFormState: () => void
}

export function useDownloadVideoForm(
  opts: UseDownloadVideoFormOptions,
): UseDownloadVideoFormReturn {
  const { isOpen, destinationFolder, t } = opts

  const { textDialog: [openTextDialog] } = useDialogs()
  const { mutate: mutateListFormats } = useListYtdlpFormatsMutation()

  // --- persisted agreement ---
  const [hasAgreed, setHasAgreed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEY, false)
  const [isAgreementChecked, setIsAgreementChecked] = useState(false)

  // Sync isAgreementChecked when dialog opens with persisted value
  useEffect(() => {
    if (!isOpen) return
    setIsAgreementChecked(hasAgreed)
  }, [isOpen, hasAgreed])

  // --- form fields ---
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlTouched, setUrlTouched] = useState(false)
  const [selectedFormatPresetId, setSelectedFormatPresetId] =
    useState<YtdlpFormatPresetId>("default")
  const [cookiesText, setCookiesText] = useState("")
  const [useCookies, setUseCookies] = useState(false)
  const [useCookiesFromBrowser, setUseCookiesFromBrowser] = useState(false)
  const [cookiesBrowser, setCookiesBrowser] = useState<YtdlpCookiesBrowserId>(
    DEFAULT_YTDLP_COOKIES_BROWSER_ID,
  )
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [extraArgSelection, setExtraArgSelection] = useState<YtdlpDownloadExtraArgSelection>(
    () => ({ ...DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION }),
  )
  const [availableHeights, setAvailableHeights] = useState<number[] | null>(null)

  const listFormatsGen = useRef(0)
  const previousUrlRef = useRef("")

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

  const resolvedYtdlpFormat = resolveYtdlpFormatFromPreset(selectedFormatPresetId)

  const is1080pAvailable =
    availableHeights === null ? true : availableHeights.includes(1080)

  const has1080pAuth =
    (useCookies && cookiesText.trim().length > 0) || useCookiesFromBrowser

  const start1080pBlocked =
    selectedFormatPresetId === "1080p" && !is1080pAvailable && !has1080pAuth

  const resolvedYtdlpExtraArgs = showMoreOptions
    ? buildYtdlpExtraArgsFromSelection(extraArgSelection)
    : undefined

  // --- validation ---
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

  // --- format probe ---
  const probeFormats = useCallback(
    (urlValue: string) => {
      const trimmed = urlValue.trim()
      if (!trimmed || !validateDownloadUrl(trimmed).valid) return
      const gen = ++listFormatsGen.current
      const cfBrowser = useCookiesFromBrowser ? cookiesBrowser : undefined
      mutateListFormats(
        { url: trimmed, cookiesFromBrowser: cfBrowser },
        {
          onSuccess: (result) => {
            if (gen !== listFormatsGen.current) return
            setAvailableHeights(result.availableHeights)
          },
          onError: () => {
            if (gen !== listFormatsGen.current) return
            setAvailableHeights(null)
          },
        },
      )
    },
    [mutateListFormats, useCookiesFromBrowser, cookiesBrowser],
  )

  // Re-probe when cookies-from-browser changes and URL is valid
  useEffect(() => {
    if (!isUrlValid) return
    probeFormats(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCookiesFromBrowser, cookiesBrowser])

  // --- handlers ---
  const handleUrlChange = useCallback(
    (value: string) => {
      setUrl(value)
      if (urlTouched) {
        runUrlValidation(value)
      }
      if (validateDownloadUrl(value.trim()).valid === false) {
        setAvailableHeights(null)
      }
    },
    [urlTouched, runUrlValidation],
  )

  const handleUrlBlur = useCallback(() => {
    setUrlTouched(true)
    runUrlValidation(url)
    probeFormats(url)
  }, [url, runUrlValidation, probeFormats])

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

  // --- URL change effect for episode/collection reset ---
  useEffect(() => {
    previousUrlRef.current = url.trim()
  }, [url])

  // --- reset ---
  const resetFormState = useCallback(() => {
    setUrl("")
    setDownloadFolder("")
    setUrlError(null)
    setUrlTouched(false)
    setSelectedFormatPresetId("default")
    setCookiesText("")
    setUseCookies(false)
    setUseCookiesFromBrowser(false)
    setCookiesBrowser(DEFAULT_YTDLP_COOKIES_BROWSER_ID)
    setShowMoreOptions(false)
    setExtraArgSelection({ ...DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION })
    setAvailableHeights(null)
    listFormatsGen.current += 1
    previousUrlRef.current = ""
  }, [])

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

    setDownloadFolder,
    setSelectedFormatPresetId,
    setCookiesText,
    setUseCookies,
    setUseCookiesFromBrowser,
    setCookiesBrowser,
    setShowMoreOptions,
    setExtraArgEnabled,

    handleUrlChange,
    handleUrlBlur,
    handleAgreementChange,
    handleOpenCookiesEditor,

    resetFormState,
  }
}
