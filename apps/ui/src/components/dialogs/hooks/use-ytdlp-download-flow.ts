import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { VideoMetadata } from "@/api/ytdlp/types"
import { useConfig } from "@/hooks/userConfig/useConfig"
import { useJobManager } from "@/hooks/useJobManager"
import {
  buildDownloadVideoJob,
  createDownloadVideoJobId,
} from "@/lib/downloadVideoJobFactory"
import { writeYtdlpCookiesFile } from "@/lib/ytdlpCookiesFile"
import {
  buildYtdlpExtraArgsFromSelection,
  type YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"
import {
  resolveYtdlpFormat,
  type YtdlpFormatPresetId,
} from "@/lib/ytdlpFormatPresets"
import type { YtdlpCookiesBrowserId } from "@/lib/ytdlpCookiesBrowsers"
import { setCachedCookies, extractHostname } from "@/lib/ytdlpCookiesCache"
import { validateDownloadUrl } from "@core/download-video-validators"

export interface VideoListItem {
  title: string
  artist: string
  url: string
}

function ytdlpMetadataToVideoListItems(entries: VideoMetadata[]): VideoListItem[] {
  return entries
    .map((v) => {
      const url = v.webpage_url?.trim() || v.original_url?.trim() || ""
      if (!url) return null
      return {
        title: (v.fulltitle || v.title || v.id) as string,
        url,
        artist: v.uploader || v.uploader_id || "",
      }
    })
    .filter((item): item is VideoListItem => item !== null)
}

export interface UseYtdlpDownloadFlowOptions {
  isOpen: boolean
  hasAgreed: boolean
  url: string
  /** Video list entries from `yt-dlp -J` when it returns a playlist; null for single videos. */
  videoListEntries: VideoMetadata[] | null
  downloadFolder: string
  selectedFormatPresetId: YtdlpFormatPresetId
  useCookies: boolean
  cookiesText: string
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  showMoreOptions: boolean
  extraArgSelection: YtdlpDownloadExtraArgSelection
  formatMode?: "preset" | "format-code"
  selectedFormatCode?: string
  selectedSupplementaryFormatCode?: string
  useJsRuntime?: boolean
  jsRuntime?: string
  onClose: () => void
  t: (key: string) => string
}

export interface UseYtdlpDownloadFlowReturn {
  /** Derived video list items from `yt-dlp -J` playlist entries. */
  videoList: VideoListItem[]
  selectedUrls: Set<string>
  isEnqueueing: boolean
  formBusy: boolean

  toggleUrlSelection: (url: string) => void
  handleStart: () => Promise<void>
  resetFlowState: () => void
}

export function useYtdlpDownloadFlow(
  opts: UseYtdlpDownloadFlowOptions,
): UseYtdlpDownloadFlowReturn {
  const {
    isOpen,
    hasAgreed,
    url,
    videoListEntries,
    downloadFolder,
    selectedFormatPresetId,
    useCookies,
    cookiesText,
    useCookiesFromBrowser,
    cookiesBrowser,
    showMoreOptions,
    extraArgSelection,
    formatMode = "preset",
    selectedFormatCode = "",
    selectedSupplementaryFormatCode = "",
    useJsRuntime = false,
    jsRuntime = "quickjs",
    onClose,
    t,
  } = opts

  const { appConfig } = useConfig()
  const { createJob } = useJobManager()

  const [isEnqueueing, setIsEnqueueing] = useState(false)

  // ── Derive video list from playlist entries ────────────────────────
  const videoList = useRef<VideoListItem[]>([])
  const getVideoList = useCallback(() => {
    if (!videoListEntries || videoListEntries.length === 0) return []
    return ytdlpMetadataToVideoListItems(videoListEntries)
  }, [videoListEntries])

  // Update when entries change
  videoList.current = getVideoList()

  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  // When videoListEntries changes (new Go), reset selection to all
  const previousEntriesKeyRef = useRef("")
  useEffect(() => {
    const key = videoListEntries
      ? videoListEntries.map((e) => e.webpage_url || e.id).join(",")
      : ""
    if (key && key !== previousEntriesKeyRef.current) {
      previousEntriesKeyRef.current = key
      const items = getVideoList()
      setSelectedUrls(new Set(items.map((i) => i.url)))
    }
  }, [videoListEntries, getVideoList])

  const resolvedYtdlpFormat = resolveYtdlpFormat({
    formatMode,
    selectedFormatCode,
    selectedSupplementaryFormatCode,
    selectedFormatPresetId,
  })
  const resolvedYtdlpExtraArgs = showMoreOptions
    ? buildYtdlpExtraArgsFromSelection(extraArgSelection)
    : undefined

  const formBusy = isEnqueueing

  // ── Enqueue pipeline ───────────────────────────────────────────────

  const prepareYtdlpCookiesFileForJob = useCallback(
    async (jobId: string): Promise<string | undefined> => {
      if (!useCookies) return undefined
      const trimmed = cookiesText.trim()
      if (!trimmed) return undefined
      const userDataDir = appConfig.userDataDir
      if (!userDataDir) {
        throw new Error(t("downloadVideo.cookiesWriteFailed"))
      }
      return writeYtdlpCookiesFile(userDataDir, jobId, trimmed)
    },
    [useCookies, cookiesText, appConfig.userDataDir, t],
  )

  const buildJobInput = useCallback(
    async (
      input: Omit<
        Parameters<typeof buildDownloadVideoJob>[0],
        | "ytdlpFormat"
        | "ytdlpCookiesFile"
        | "ytdlpCookiesFromBrowser"
        | "ytdlpExtraArgs"
        | "id"
      >,
    ) => {
      const id = createDownloadVideoJobId()
      const ytdlpCookiesFile = await prepareYtdlpCookiesFileForJob(id)
      return buildDownloadVideoJob({
        ...input,
        id,
        ytdlpFormat: resolvedYtdlpFormat,
        ...(ytdlpCookiesFile ? { ytdlpCookiesFile } : {}),
        ...(useCookiesFromBrowser ? { ytdlpCookiesFromBrowser: cookiesBrowser } : {}),
        ...(resolvedYtdlpExtraArgs && resolvedYtdlpExtraArgs.length > 0
          ? { ytdlpExtraArgs: resolvedYtdlpExtraArgs }
          : {}),
        ...(useJsRuntime && jsRuntime
          ? { ytdlpJsRuntime: jsRuntime, ytdlpJsRuntimePath: "" }
          : {}),
      })
    },
    [
      prepareYtdlpCookiesFileForJob,
      resolvedYtdlpFormat,
      useCookiesFromBrowser,
      cookiesBrowser,
      resolvedYtdlpExtraArgs,
      useJsRuntime,
      jsRuntime,
    ],
  )

  const toggleUrlSelection = useCallback((id: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleStart = useCallback(async () => {
    if (!hasAgreed) return

    const validation = validateDownloadUrl(url.trim())
    if (!validation.valid) return

    if (!downloadFolder.trim()) return

    if (useCookies && !cookiesText.trim()) {
      toast.error(t("downloadVideo.cookiesEmpty"))
      return
    }

    // Cache cookies for this domain
    const hostname = extractHostname(url.trim())
    if (hostname) {
      setCachedCookies(hostname, {
        cookiesText,
        useCookies,
        useCookiesFromBrowser,
        cookiesBrowser,
      })
    }

    setIsEnqueueing(true)
    try {
      const currentList = videoList.current
      let urls: string[]

      if (currentList.length > 0) {
        // Multi-video: use selected URLs
        const u = Array.from(selectedUrls)
        if (u.length === 0) {
          toast.error(t("downloadVideo.episodesNoneSelected"))
          return
        }
        urls = u
      } else {
        // Single video
        urls = [url.trim()]
      }

      const parentId = urls.length > 1 ? createDownloadVideoJobId() : undefined
      const jobs = await Promise.all(
        urls.map((u) => {
          const item = currentList.find((e) => e.url === u)
          return buildJobInput({
            name: item?.title || "Download Video",
            folder: downloadFolder,
            urls: [u],
            itemMeta: item ? [{ title: item.title, artist: item.artist }] : undefined,
            parentId,
          })
        }),
      )

      await Promise.all(jobs.map((job) => createJob(job)))
      onClose()
    } catch (error) {
      console.error("[DownloadVideoDialog] Failed to enqueue download job:", error)
      toast.error(error instanceof Error ? error.message : "Download failed")
    } finally {
      setIsEnqueueing(false)
    }
  }, [
    hasAgreed,
    url,
    downloadFolder,
    useCookies,
    cookiesText,
    useCookiesFromBrowser,
    cookiesBrowser,
    selectedUrls,
    buildJobInput,
    createJob,
    onClose,
    t,
  ])

  // --- reset all flow state ---

  const resetFlowState = useCallback(() => {
    setIsEnqueueing(false)
    setSelectedUrls(new Set())
  }, [])

  return {
    videoList: videoList.current,
    selectedUrls,
    isEnqueueing,
    formBusy,
    toggleUrlSelection,
    handleStart,
    resetFlowState,
  }
}
