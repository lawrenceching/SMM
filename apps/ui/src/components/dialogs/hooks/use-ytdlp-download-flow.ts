import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { YtdlpVideo } from "@core/types/YtdlpTypes"
import {
  useBilibiliCollectionMetadataMutation,
  useBilibiliEpisodesMetadataMutation,
  useExtractYtdlpVideoDataMutation,
} from "@/hooks/ytdlp/useYtdlpMutations"
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

interface EpisodeItem {
  title: string
  artist: string
  url: string
}

function ytdlpVideosToEpisodeItems(videos: YtdlpVideo[]): EpisodeItem[] {
  return videos
    .map((v) => {
      const url = v.webpage_url?.trim() || v.original_url?.trim() || ""
      if (!url) return null
      return {
        title: (v.fulltitle || v.title || v.id) as string,
        url,
        artist: v.uploader || v.uploader_id || "",
      }
    })
    .filter((item): item is EpisodeItem => item !== null)
}

export interface UseYtdlpDownloadFlowOptions {
  isOpen: boolean
  hasAgreed: boolean
  url: string
  isCollectionUrl: boolean
  canDownloadEpisodes: boolean
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
  downloadEpisodes: boolean
  downloadCollectionVideos: boolean

  episodes: EpisodeItem[]
  episodesLoading: boolean
  episodesError: string | null
  selectedEpisodeUrls: Set<string>

  collectionEntries: { url: string }[]
  selectedCollectionUrls: Set<string>
  collectionError: string | null
  collectionMetadataLoading: boolean

  isEnqueueing: boolean
  formBusy: boolean

  handleDownloadEpisodesChange: (checked: boolean) => void
  toggleEpisodeSelection: (url: string) => void
  handleDownloadCollectionVideosChange: (checked: boolean) => void
  toggleCollectionUrlSelection: (url: string) => void
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
    isCollectionUrl,
    canDownloadEpisodes,
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

  const { mutate: mutateEpisodesMetadata, reset: resetEpisodesMetadata } =
    useBilibiliEpisodesMetadataMutation()
  const {
    mutate: mutateCollectionMetadata,
    reset: resetCollectionMetadata,
    isPending: collectionMetadataLoading,
  } = useBilibiliCollectionMetadataMutation()
  const extractMutation = useExtractYtdlpVideoDataMutation()

  const [downloadEpisodes, setDownloadEpisodes] = useState(false)
  const [downloadCollectionVideos, setDownloadCollectionVideos] = useState(false)
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [selectedEpisodeUrls, setSelectedEpisodeUrls] = useState<Set<string>>(new Set())
  const [isEnqueueing, setIsEnqueueing] = useState(false)
  const [collectionEntries, setCollectionEntries] = useState<{ url: string }[]>([])
  const [selectedCollectionUrls, setSelectedCollectionUrls] = useState<Set<string>>(new Set())
  const [collectionError, setCollectionError] = useState<string | null>(null)

  const episodesFetchGen = useRef(0)

  const resolvedYtdlpFormat = resolveYtdlpFormat({
    formatMode,
    selectedFormatCode,
    selectedSupplementaryFormatCode,
    selectedFormatPresetId,
  })
  const resolvedYtdlpExtraArgs = showMoreOptions
    ? buildYtdlpExtraArgsFromSelection(extraArgSelection)
    : undefined

  const formBusy =
    isEnqueueing ||
    (downloadEpisodes && episodesLoading) ||
    (downloadCollectionVideos && collectionMetadataLoading)

  // --- reset helpers ---

  const resetEpisodesState = useCallback(() => {
    episodesFetchGen.current += 1
    setDownloadEpisodes(false)
    setEpisodes([])
    setSelectedEpisodeUrls(new Set())
    setEpisodesError(null)
    setEpisodesLoading(false)
    resetEpisodesMetadata()
  }, [resetEpisodesMetadata])

  const resetCollectionState = useCallback(() => {
    setDownloadCollectionVideos(false)
    setCollectionEntries([])
    setSelectedCollectionUrls(new Set())
    setCollectionError(null)
    resetCollectionMetadata()
  }, [resetCollectionMetadata])

  // --- fetch episodes ---

  const fetchEpisodesMetadata = useCallback(() => {
    if (!isOpen || !hasAgreed) return
    const trimmed = url.trim()
    if (!trimmed || !validateDownloadUrl(trimmed).valid) {
      setEpisodes([])
      setSelectedEpisodeUrls(new Set())
      setEpisodesError(null)
      setEpisodesLoading(false)
      resetEpisodesMetadata()
      return
    }
    const gen = ++episodesFetchGen.current
    setEpisodesLoading(true)
    setEpisodesError(null)
    mutateEpisodesMetadata(trimmed, {
      onSuccess: (result) => {
        if (gen !== episodesFetchGen.current) return
        if (result.error) {
          setEpisodesError(result.error)
          setEpisodes([])
          setSelectedEpisodeUrls(new Set())
        } else {
          const items = ytdlpVideosToEpisodeItems(result.videos ?? [])
          setEpisodes(items)
          setSelectedEpisodeUrls(new Set(items.map((v) => v.url)))
          setEpisodesError(null)
        }
      },
      onSettled: () => {
        if (gen === episodesFetchGen.current) {
          setEpisodesLoading(false)
        }
      },
    })
  }, [isOpen, hasAgreed, url, mutateEpisodesMetadata, resetEpisodesMetadata])

  // --- fetch collection ---

  const fetchCollectionMetadata = useCallback(() => {
    if (!hasAgreed || !isCollectionUrl) return
    const trimmed = url.trim()
    setCollectionError(null)
    mutateCollectionMetadata(trimmed, {
      onSuccess: (metadata) => {
        setCollectionEntries(metadata.entries)
        setSelectedCollectionUrls(
          new Set(metadata.entries.map((e) => e.url.trim()).filter(Boolean)),
        )
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setCollectionError(message)
        setCollectionEntries([])
        setSelectedCollectionUrls(new Set())
        toast.error(message)
      },
    })
  }, [hasAgreed, isCollectionUrl, url, mutateCollectionMetadata])

  // --- toggles ---

  const handleDownloadEpisodesChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        resetEpisodesState()
        return
      }
      setDownloadEpisodes(true)
      fetchEpisodesMetadata()
    },
    [resetEpisodesState, fetchEpisodesMetadata],
  )

  const handleDownloadCollectionVideosChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        resetCollectionState()
        return
      }
      setDownloadCollectionVideos(true)
      fetchCollectionMetadata()
    },
    [resetCollectionState, fetchCollectionMetadata],
  )

  const toggleEpisodeSelection = useCallback((id: string) => {
    setSelectedEpisodeUrls((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCollectionUrlSelection = useCallback((id: string) => {
    setSelectedCollectionUrls((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // --- URL change effects ---

  const previousUrlRef = useRef("")
  useEffect(() => {
    const current = url.trim()
    const previous = previousUrlRef.current
    if (previous && previous !== current && downloadEpisodes) {
      resetEpisodesState()
    }
    if (previous && previous !== current) {
      resetCollectionState()
    }
    previousUrlRef.current = current
  }, [url, downloadEpisodes, resetEpisodesState, resetCollectionState])

  useEffect(() => {
    if (canDownloadEpisodes) return
    const hasEpisodesStateToReset =
      downloadEpisodes ||
      episodes.length > 0 ||
      selectedEpisodeUrls.size > 0 ||
      episodesError !== null ||
      episodesLoading
    if (!hasEpisodesStateToReset) return
    resetEpisodesState()
  }, [
    canDownloadEpisodes,
    downloadEpisodes,
    episodes.length,
    selectedEpisodeUrls.size,
    episodesError,
    episodesLoading,
    resetEpisodesState,
  ])

  // --- enqueue pipeline ---

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
        "ytdlpFormat" | "ytdlpCookiesFile" | "ytdlpCookiesFromBrowser" | "ytdlpExtraArgs" | "id"
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

    if (isCollectionUrl) {
      if (selectedCollectionUrls.size === 0) {
        toast.error(t("downloadVideo.episodesNoneSelected"))
        return
      }
      setIsEnqueueing(true)
      try {
        const parentId = createDownloadVideoJobId()
        const collectionJobs = await Promise.all(
          Array.from(selectedCollectionUrls).map((u) =>
            buildJobInput({
              name: "Download Video",
              folder: downloadFolder,
              urls: [u],
              itemMeta: [{ title: u, artist: "" }],
              parentId,
            }),
          ),
        )
        await Promise.all(collectionJobs.map((job) => createJob(job)))
        onClose()
      } catch (error) {
        console.error("[DownloadVideoDialog] Failed to enqueue download job:", error)
        toast.error(error instanceof Error ? error.message : "Download failed")
      } finally {
        setIsEnqueueing(false)
      }
      return
    }

    setIsEnqueueing(true)
    try {
      let urls: string[] = []
      if (downloadEpisodes) {
        if (selectedEpisodeUrls.size === 0) {
          console.warn("[DownloadVideoDialog] No episodes selected for multi-episode download")
          return
        }
        urls = Array.from(selectedEpisodeUrls)
      } else {
        urls = [url.trim()]
      }

      const parentId = urls.length > 1 ? createDownloadVideoJobId() : undefined
      const jobs = await Promise.all(
        urls.map((u) => {
          const episode = episodes.find((e) => e.url === u)
          return buildJobInput({
            name: episode?.title || "Download Video",
            folder: downloadFolder,
            urls: [u],
            itemMeta: episode ? [{ title: episode.title, artist: episode.artist }] : undefined,
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
    isCollectionUrl,
    selectedCollectionUrls,
    downloadEpisodes,
    selectedEpisodeUrls,
    episodes,
    buildJobInput,
    createJob,
    onClose,
    t,
  ])

  // --- reset all flow state (does NOT call onClose) ---

  const resetFlowState = useCallback(() => {
    episodesFetchGen.current += 1
    setDownloadEpisodes(false)
    setEpisodes([])
    setEpisodesLoading(false)
    setEpisodesError(null)
    setSelectedEpisodeUrls(new Set())
    setIsEnqueueing(false)
    resetEpisodesMetadata()
    setDownloadCollectionVideos(false)
    setCollectionEntries([])
    setSelectedCollectionUrls(new Set())
    setCollectionError(null)
    resetCollectionMetadata()
    extractMutation.reset()
  }, [resetEpisodesMetadata, resetCollectionMetadata, extractMutation])

  return {
    downloadEpisodes,
    downloadCollectionVideos,

    episodes,
    episodesLoading,
    episodesError,
    selectedEpisodeUrls,

    collectionEntries,
    selectedCollectionUrls,
    collectionError,
    collectionMetadataLoading,

    isEnqueueing,
    formBusy,

    handleDownloadEpisodesChange,
    toggleEpisodeSelection,
    handleDownloadCollectionVideosChange,
    toggleCollectionUrlSelection,
    handleStart,
    resetFlowState,
  }
}
