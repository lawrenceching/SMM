import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { VideoMetadata } from "@/api/ytdlp/types"
import { downloadVideoViaCore } from "@/api/downloadVideo"
import type { DownloadSubtitleLang } from "@/api/ytdlpListSubs"
import { pollYtdlpJob } from "@/lib/pollYtdlpJob"
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
import { validateDownloadUrl } from "@smm/core/download-video-validators"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import type { JobStatus, YtdlpBackgroundJob } from "@/types/background-jobs"

interface VideoListItem {
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

function toJobStatus(status: string): JobStatus {
  if (
    status === "pending" ||
    status === "running" ||
    status === "failed" ||
    status === "succeeded" ||
    status === "aborted" ||
    status === "stopped"
  ) {
    return status
  }
  return "running"
}

function upsertYtdlpJobFromCore(params: {
  id: string
  url: string
  folder: string
  title?: string
  status?: JobStatus
  progress?: number
  speedBps?: number
  etaSeconds?: number | null
  errorType?: string
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: YtdlpBackgroundJob = {
    id: params.id,
    name: params.title?.trim() || params.url,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "ytdlp",
    data: {
      folder: params.folder,
      url: params.url,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      ...(params.speedBps !== undefined ? { speedBps: params.speedBps } : {}),
      ...(params.etaSeconds !== undefined ? { etaSeconds: params.etaSeconds } : {}),
      ...(params.errorType ? { errorType: params.errorType } : {}),
      ...(params.error ? { error: params.error } : {}),
      logRelativePath: `job-${params.id}.log`,
    },
  }
  if (existing) {
    useBackgroundJobsStore.getState().updateJob(params.id, {
      name: next.name,
      status: next.status,
      progress: next.progress,
      data: next.data,
    })
  } else {
    useBackgroundJobsStore.getState().addJob(next)
  }
}

export interface UseYtdlpDownloadFlowOptions {
  isOpen: boolean
  hasAgreed: boolean
  url: string
  /** Video list entries from `yt-dlp -J` playlist entries. */
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
  /** Absolute path to JS runtime binary (e.g. bundled QuickJS). */
  jsRuntimePath?: string
  /** Proxy URL for yt-dlp `--proxy`. */
  proxy?: string
  /** bgutil HTTP POT provider base URL. */
  potProviderUrl?: string
  /** Subtitle languages to pass to each download. Omitted when none are selected. */
  subtitleLangs?: DownloadSubtitleLang[]
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
    jsRuntimePath,
    proxy,
    potProviderUrl,
    subtitleLangs,
    onClose,
    t,
  } = opts

  const [isEnqueueing, setIsEnqueueing] = useState(false)

  const videoList = useRef<VideoListItem[]>([])
  const getVideoList = useCallback(() => {
    if (!videoListEntries || videoListEntries.length === 0) return []
    return ytdlpMetadataToVideoListItems(videoListEntries)
  }, [videoListEntries])

  videoList.current = getVideoList()

  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

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
        const u = Array.from(selectedUrls)
        if (u.length === 0) {
          toast.error(t("downloadVideo.episodesNoneSelected"))
          return
        }
        urls = u
      } else {
        urls = [url.trim()]
      }

      const proxyTrimmed = proxy?.trim()
      const potProviderUrlTrimmed = potProviderUrl?.trim()
      const cookiesTextTrimmed = useCookies ? cookiesText.trim() : undefined
      const cookiesFromBrowser = useCookiesFromBrowser ? cookiesBrowser : undefined
      const extraArgs =
        resolvedYtdlpExtraArgs && resolvedYtdlpExtraArgs.length > 0
          ? resolvedYtdlpExtraArgs
          : undefined

      const failedUrls: string[] = []
      for (const downloadUrl of urls) {
        const item = currentList.find((e) => e.url === downloadUrl)
        const title = item?.title || undefined
        try {
          const id = await downloadVideoViaCore({
            url: downloadUrl,
            folder: downloadFolder,
            ...(title ? { title } : {}),
            ...(resolvedYtdlpFormat ? { format: resolvedYtdlpFormat } : {}),
            ...(extraArgs ? { extraArgs } : {}),
            ...(cookiesTextTrimmed ? { cookiesText: cookiesTextTrimmed } : {}),
            ...(cookiesFromBrowser ? { cookiesFromBrowser } : {}),
            ...(useJsRuntime && jsRuntime
              ? {
                  jsRuntime,
                  ...(jsRuntimePath?.trim() ? { jsRuntimePath: jsRuntimePath.trim() } : {}),
                }
              : {}),
            ...(proxyTrimmed ? { proxy: proxyTrimmed } : {}),
            ...(potProviderUrlTrimmed ? { potProviderUrl: potProviderUrlTrimmed } : {}),
            ...(subtitleLangs && subtitleLangs.length > 0 ? { subtitleLangs } : {}),
          })

          upsertYtdlpJobFromCore({
            id,
            url: downloadUrl,
            folder: downloadFolder,
            title,
            status: "pending",
            progress: 0,
          })

          void pollYtdlpJob(id, (job) => {
            upsertYtdlpJobFromCore({
              id: job.id,
              url: job.url,
              folder: job.folder,
              title: job.title,
              status: toJobStatus(job.status),
              progress: job.progress,
              speedBps: job.speedBps,
              etaSeconds: job.etaSeconds,
              errorType: job.errorType,
              error: job.error,
            })
          }).catch((error: unknown) => {
            console.error("[DownloadVideoDialog] poll ytdlp job failed:", error)
            useBackgroundJobsStore.getState().updateJob(id, { status: "failed" })
          })
        } catch (error) {
          console.error("[DownloadVideoDialog] Failed to enqueue download:", downloadUrl, error)
          failedUrls.push(downloadUrl)
          toast.error(
            error instanceof Error
              ? error.message
              : t("downloadVideo.enqueueFailed") || "Download failed",
          )
        }
      }

      if (failedUrls.length === 0 || failedUrls.length < urls.length) {
        onClose()
      }
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
    resolvedYtdlpFormat,
    resolvedYtdlpExtraArgs,
    useJsRuntime,
    jsRuntime,
    jsRuntimePath,
    proxy,
    potProviderUrl,
    subtitleLangs,
    onClose,
    t,
  ])

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
