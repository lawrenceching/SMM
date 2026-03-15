import { Spinner } from "@/components/ui/spinner"
import { basename, isAbsPath, join, relative } from "@/lib/path"
import { Path } from "@core/path"
import { pathToFileURL } from "@core/url"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon, Loader2, Video } from "lucide-react"
import Image from "@/components/Image"
import { useState, useMemo, useEffect, useRef } from "react"
import { useDialogs } from "@/providers/dialog-provider"
import { generateFfmpegScreenshots } from "@/api/ffmpeg"
import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { renameFiles } from "@/api/renameFiles"
import { openFile } from "@/api/openFile"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { computeAssociatedFileRenames } from "./episode-file"

export interface TvShowEpisodeDividerRow {
  id: string
  type: "divider"
  text: string
}

export interface TvShowEpisodeDataRow {
  season: number,
  episode: number,
  type: "episode"
  videoFile: string | undefined
  thumbnail: string | undefined
  subtitle: string | undefined
  nfo: string | undefined
  /** Episode title from TMDB (for detail layout). */
  episodeTitle?: string
  /** Preview target paths (used when preview mode is active) */
  newVideoFile?: string
  newThumbnail?: string
  newSubtitle?: string
  newNfo?: string
  checked: boolean
}

export type FolderFileId = "clearlogo" | "fanart" | "poster" | "theme" | "nfo"

export interface TvShowFolderFileRow {
  id: FolderFileId
  type: "folderFile"
  path: string
}

export type TvShowEpisodeTableRow = TvShowEpisodeDividerRow | TvShowEpisodeDataRow | TvShowFolderFileRow

interface TvShowEpisodeTableProps {
  data: TvShowEpisodeTableRow[]
  /** Checkboxes state, used to show checked state in table. */
  // checkboxes: {season: number, episode: number, checked: boolean}[]
  /** When set, video paths are shown relative to this path. */
  mediaFolderPath?: string
  /** Called when user chooses "Select File" from context menu; row is the row data. */
  onVideoFileSelect?: (row: TvShowEpisodeDataRow) => void
  /** Called when user chooses "Unlink" from context menu; row is the row data. */
  onUnlinkEpisode?: (row: TvShowEpisodeDataRow) => void
  /** Called when user chooses "Edit tags" from context menu; row is the row data. */
  onEditTags?: (row: TvShowEpisodeDataRow) => void
  /**
   * NOTE: preview mode is different concept from preview layout.
   * ** Preivew Mode ** Preview the recognition or rename plan
   * ** Preivew Layout ** Display video screenshots for video
   */
  preview?: "rename" | "recognize"
  previewStatus?: "loading" | "ok"
  /**
   * NOTE: preview mode is different concept from preview layout.
   * ** Preivew Mode ** Preview the recognition or rename plan
   * ** Preivew Layout ** Display video screenshots for video 
   * Table layout: simple | detail (cover + title + path) | preview (no ID, larger cover, video screenshot). 
   * */
  layout?: "simple" | "detail" | "preview"
  onCheck?: (row: TvShowEpisodeDataRow, checked: boolean) => void
}

/**
 * 重要说明:
 * 
 * 当 TvShowEpisodeTable 进入预览模式 (preview prop 为 true) 时,父组件需要自动将 layout 切换为 'simple' 模式。
 * 
 * 原因: 前台模式 (detail 和 preview layout) 不支持预览功能,因为:
 * 1. Preview 布局本身就是为了展示预览内容,与 preview prop 的功能重叠
 * 2. Detail 布局包含额外的元数据显示,与预览模式的简化显示冲突
 * 3. Simple 布局是最适合展示重命名预览的布局,能够清晰显示旧文件名和新文件名
 * 
 * 参见: TvShowPanel.tsx 中 handleRuleBasedRenameConfirm 和 openAiBasedRenameFilePrompt 的实现
 */

function CheckCell({ value }: { value: string | undefined }) {
  const checked = value !== undefined

  if (checked) {
    return (
      <div className="flex items-center justify-center">
        <CheckIcon className="size-3.5 text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <MinusIcon className="size-3.5 text-muted-foreground" />
    </div>
  )
}

function getDisplayPath(fullPath: string, basePath: string | undefined): string {
  if (!basePath) return fullPath
  try {
    return relative(basePath, fullPath)
  } catch {
    return fullPath
  }
}

/** Builds a file:// URL for the thumbnail that the backend can resolve (platform path → file URL). */
function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {
  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  const url = pathToFileURL(platformPath)
  if (import.meta.env.DEV) {
    console.debug("[TvShowEpisodeTable] thumbnail image url", {
      thumbnailPath,
      absolutePath,
      platformPath,
      url,
    })
  }
  return url
}

function ThumbnailImage({
  thumbnailPath,
  mediaFolderPath,
  className = "max-h-[240px] w-auto rounded object-contain",
}: {
  thumbnailPath: string
  mediaFolderPath: string | undefined
  className?: string
}) {
  const url = getThumbnailImageUrl(thumbnailPath, mediaFolderPath)
  return <Image url={url} alt="" className={className} />
}

/** Global queue to ensure only one screenshot generation runs at a time. */
let screenshotQueue: Promise<void> = Promise.resolve()

function enqueueScreenshotTask(task: () => Promise<void>) {
  screenshotQueue = screenshotQueue.then(task).catch((error) => {
    console.error("[TvShowEpisodeTable] screenshot task error", error)
  })
  return screenshotQueue
}

const SCREENSHOT_SLOT_COUNT = 5

const LOG = "[EpisodeVideoScreenshot]"

/** Fetches and displays video screenshots (multiple) for a video file path. */
function EpisodeVideoScreenshot({
  videoPath,
  mediaFolderPath,
  folderAbortSignal,
  className,
}: {
  videoPath: string
  mediaFolderPath: string | undefined
  /** When aborted (e.g. user switched folder), pending/queued screenshot requests are cancelled. */
  folderAbortSignal?: AbortSignal
  className?: string
}) {
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  /** Ref to detect stale results: only apply when task's path still matches current. */
  const loadingPathRef = useRef<string | null>(null)

  useEffect(() => {
    const label = videoPath ? basename(videoPath) || videoPath : "(no path)"
    if (!videoPath) {
      console.log(LOG, "effect run (no videoPath)", { label })
      setScreenshots([])
      setLoading(false)
      loadingPathRef.current = null
      return
    }
    setLoading(true)
    setError(false)
    const absolutePath =
      mediaFolderPath && !isAbsPath(videoPath) ? join(mediaFolderPath, videoPath) : videoPath
    const posixPath = Path.posix(absolutePath)
    loadingPathRef.current = posixPath
    const signal = folderAbortSignal
    console.log(LOG, "effect run, enqueue task", { label, posixPath: posixPath.slice(-60), signalAborted: signal?.aborted })

    enqueueScreenshotTask(async () => {
      if (signal?.aborted) {
        console.log(LOG, "task start skip (signal aborted)", { label })
        return
      }
      console.log(LOG, "task start, calling API", { label })
      try {
        const result = await generateFfmpegScreenshots(posixPath, { signal })
        const screenshotsLen = result.screenshots?.length ?? 0
        const stillCurrent = loadingPathRef.current === posixPath
        console.log(LOG, "API returned", {
          label,
          screenshotsLen,
          signalAborted: signal?.aborted,
          loadingPathRefCurrent: loadingPathRef.current?.slice(-60) ?? null,
          posixPathTail: posixPath.slice(-60),
          stillCurrent,
        })
        if (signal?.aborted) {
          console.log(LOG, "skip setState (signal aborted)", { label })
          return
        }
        if (loadingPathRef.current !== posixPath) {
          console.log(LOG, "skip setState (path no longer current)", { label })
          return
        }
        if (result.screenshots && result.screenshots.length > 0) {
          setScreenshots(result.screenshots)
          console.log(LOG, "setScreenshots called", { label, count: result.screenshots.length })
        } else {
          setScreenshots([])
          console.log(LOG, "setScreenshots([]) (no screenshots in result)", { label })
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const errName = err instanceof Error ? err.name : ""
        console.log(LOG, "API error", label, errName, errMsg, "signalAborted:", signal?.aborted, "stillCurrent:", loadingPathRef.current === posixPath)
        if (signal?.aborted) return
        if (loadingPathRef.current === posixPath) {
          setError(true)
          setScreenshots([])
        }
      } finally {
        const doSetLoadingFalse = loadingPathRef.current === posixPath && !signal?.aborted
        console.log(LOG, "finally", { label, doSetLoadingFalse, loadingPathRefCurrent: loadingPathRef.current?.slice(-60) ?? null, posixPathTail: posixPath.slice(-60) })
        if (doSetLoadingFalse) {
          setLoading(false)
        }
      }
    })

    return () => {
      console.log(LOG, "effect cleanup", { label })
      loadingPathRef.current = null
    }
  }, [videoPath, mediaFolderPath, folderAbortSignal])

  if (loading) {
    return (
      <div
        className={cn(
          "grid grid-cols-5 gap-1 min-h-[60px]",
          className
        )}
      >
        {Array.from({ length: SCREENSHOT_SLOT_COUNT }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded bg-muted aspect-video min-h-[40px]"
          >
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }
  if (error || screenshots.length === 0) {
    return (
      <div
        className={cn(
          "grid grid-cols-5 gap-1 min-h-[60px]",
          className
        )}
      >
        {Array.from({ length: SCREENSHOT_SLOT_COUNT }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded bg-muted aspect-video min-h-[40px]"
          >
            <Video className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={cn("grid grid-cols-5 gap-1", className)}>
      {screenshots.map((path, i) => (
        <Image
          key={i}
          url={pathToFileURL(path)}
          alt=""
          className="w-full h-auto rounded object-contain aspect-video max-h-[80px]"
        />
      ))}
    </div>
  )
}

const COLUMN_KEYS = ["video", "thumbnail", "subtitle", "nfo"] as const
type ColumnKey = (typeof COLUMN_KEYS)[number]

const getColumnLabels = (t: (key: string, options?: Record<string, unknown>) => string): Record<ColumnKey, string> => ({
  video: t('tvShowEpisodeTable.columns.video'),
  thumbnail: t('tvShowEpisodeTable.columns.thumbnail'),
  subtitle: t('tvShowEpisodeTable.columns.subtitle'),
  nfo: t('tvShowEpisodeTable.columns.nfo'),
})

const defaultColumnVisibility: Record<ColumnKey, boolean> = {
  video: true,
  thumbnail: true,
  subtitle: true,
  nfo: true,
}

export function TvShowEpisodeTable({
  data,
  // checkboxes,
  mediaFolderPath,
  onVideoFileSelect,
  onUnlinkEpisode,
  onEditTags,
  preview,
  previewStatus,
  layout = "simple",
  onCheck }: TvShowEpisodeTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(defaultColumnVisibility)
  const folderAbortRef = useRef<AbortController | null>(null)
  if (layout === "preview" && !folderAbortRef.current) {
    folderAbortRef.current = new AbortController()
  }
  const folderAbortSignal = folderAbortRef.current?.signal

  // When leaving preview layout, cancel in-flight/queued screenshot requests.
  useEffect(() => {
    if (layout !== "preview") {
      folderAbortRef.current?.abort()
      folderAbortRef.current = null
    }
  }, [layout])

  // On unmount, cancel any screenshot requests.
  useEffect(() => {
    return () => {
      folderAbortRef.current?.abort()
      folderAbortRef.current = null
    }
  }, [])

  const { t } = useTranslation(['components', 'dialogs'])
  const { selectedMediaMetadata } = useMediaMetadataStoreState()
  const { refreshMediaMetadata } = useMediaMetadataActions()
  const { renameDialog } = useDialogs()
  const [openRename] = renameDialog

  const columnLabels = getColumnLabels(t as (key: string, options?: Record<string, unknown>) => string)

  const sectionIdByIndex = useMemo(() => {
    const map = new Map<number, string>()
    let currentId = ""
    data.forEach((row, index) => {
      if (row.type === "divider") {
        currentId = row.id
      }
      map.set(index, currentId)
    })
    return map
  }, [data])

  const toggleCollapsed = (dividerId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dividerId)) next.delete(dividerId)
      else next.add(dividerId)
      return next
    })
  }

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isSimpleLayout = layout === "simple"
  const isPreviewLayout = layout === "preview"
  const showThumbnailColumn = (!isSimpleLayout && layout === "detail") || isPreviewLayout || columnVisibility.thumbnail
  const showIdColumn = layout !== "preview"
  const showCheckboxColumn = preview !== undefined
  const visibleColumnCount =
    (showCheckboxColumn ? 1 : 0) +
    (showIdColumn ? 1 : 0) +
    (showThumbnailColumn ? 1 : 0) +
    (columnVisibility.video ? 1 : 0) +
    (columnVisibility.subtitle ? 1 : 0) +
    (columnVisibility.nfo ? 1 : 0)

  const thumbnailCellWidth = isPreviewLayout ? "w-[160px] min-w-[160px]" : layout === "detail" ? "w-[100px] min-w-[100px]" : ""

  const headerRow = (
    <TableRow className="hover:bg-transparent">
      {showCheckboxColumn && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center" title={t('tvShowEpisodeTable.renameCheckboxTitle', { defaultValue: 'Include in rename' })}>
          {t('tvShowEpisodeTable.renameCheckboxHeader', { defaultValue: '' })}
        </TableHead>
      )}
      {showIdColumn && (
        <TableHead className="h-8 w-[100px] px-2 py-1">{t('tvShowEpisodeTable.columns.id')}</TableHead>
      )}
      {isSimpleLayout ? (
        <>
          {columnVisibility.video && (
            <TableHead className="h-8 min-w-0 px-2 py-1">{t('tvShowEpisodeTable.header.videoFile')}</TableHead>
          )}
          {showThumbnailColumn && (
            <TableHead
              className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
              title={t('tvShowEpisodeTable.columns.thumbnail')}
            >
              {t('tvShowEpisodeTable.header.thumb')}
            </TableHead>
          )}
        </>
      ) : (
        <>
          {showThumbnailColumn && (
            <TableHead
              className={cn(
                "h-8 px-1 py-1",
                thumbnailCellWidth || "w-10 shrink-0 px-0 text-center whitespace-nowrap"
              )}
              title={t('tvShowEpisodeTable.columns.thumbnail')}
            >
              {t('tvShowEpisodeTable.header.thumb')}
            </TableHead>
          )}
          {columnVisibility.video && (
            <TableHead className="h-8 min-w-0 px-2 py-1">{t('tvShowEpisodeTable.header.videoFile')}</TableHead>
          )}
        </>
      )}
      {columnVisibility.subtitle && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title={t('tvShowEpisodeTable.columns.subtitle')}>{t('tvShowEpisodeTable.header.sub')}</TableHead>
      )}
      {columnVisibility.nfo && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap">{t('tvShowEpisodeTable.columns.nfo')}</TableHead>
      )}
    </TableRow>
  )

  return (
    <section data-testid="tvshow-episode-table" className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <TableHeader>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              {headerRow}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuSub>
                <ContextMenuSubTrigger>{t('tvShowEpisodeTable.contextMenu.showColumns')}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.video}
                    onCheckedChange={() => toggleColumn("video")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.video}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.thumbnail}
                    onCheckedChange={() => toggleColumn("thumbnail")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.thumbnail}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.subtitle}
                    onCheckedChange={() => toggleColumn("subtitle")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.subtitle}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.nfo}
                    onCheckedChange={() => toggleColumn("nfo")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.nfo}
                  </ContextMenuCheckboxItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            if (row.type === "divider") {
              const isCollapsed = collapsedIds.has(row.id)
              return (
                <TableRow key={`${row.id}-${index}`} className="bg-muted/60 hover:bg-muted/70">
                  {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
                  <TableCell colSpan={visibleColumnCount - (showCheckboxColumn ? 1 : 0)} className="px-2 py-1.5 font-semibold">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.text}</span>
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(row.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isCollapsed ? t('tvShowEpisodeTable.expand') : t('tvShowEpisodeTable.collapse')}
                        aria-label={isCollapsed ? t('tvShowEpisodeTable.expand') : t('tvShowEpisodeTable.collapse')}
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            if (row.type === "folderFile") {
              const folderFileRow = (
                <TableRow key={`${row.id}-${index}`}>
                  {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
                  <TableCell className="px-2 py-1 font-mono w-[100px]">{row.id}</TableCell>
                  <TableCell colSpan={visibleColumnCount - (showCheckboxColumn ? 2 : 1)} className="max-w-px px-2 py-1 truncate" title={row.path}>
                    {getDisplayPath(row.path, mediaFolderPath)}
                  </TableCell>
                </TableRow>
              )

              return (
                <ContextMenu key={`${row.id}-${index}`}>
                  <ContextMenuTrigger asChild>
                    {folderFileRow}
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        const absolutePath = mediaFolderPath && !isAbsPath(row.path) ? join(mediaFolderPath, row.path) : row.path
                        const platformPath = Path.toPlatformPath(absolutePath)
                        openFile(platformPath).catch((error) => {
                          console.error('[TvShowEpisodeTable] Failed to open folder file:', error)
                        })
                      }}
                    >
                      {t('episodeFile.open', { ns: 'components' })}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            }

            const sectionId = sectionIdByIndex.get(index)
            if (sectionId && collapsedIds.has(sectionId)) {
              return null
            }

            const episodeRow = (
              <TableRow key={`${row.season}-${row.episode}-${index}`}>
                {showCheckboxColumn && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center align-middle">
                    <input
                      type="checkbox"
                      role="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer"
                      checked={row.checked}
                      onChange={(e) => {
                        onCheck?.(row, e.target.checked)
                      }}
                    />
                  </TableCell>
                )}
                {showIdColumn && (
                  <TableCell className="px-2 py-1 font-mono">{`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}</TableCell>
                )}
                {isSimpleLayout && columnVisibility.video && (
                  <TableCell className="max-w-px px-2 py-1">
                    {row.videoFile ? (
                      preview === 'rename' && !row.newVideoFile ? (
                        <div className="truncate text-muted-foreground/60 line-through text-xs" title={row.videoFile}>
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      ) : preview === 'rename' && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
                        <div className="min-w-0 space-y-0.5">
                          <div className="truncate text-muted-foreground/60 line-through text-xs" title={row.videoFile}>
                            {getDisplayPath(row.videoFile, mediaFolderPath)}
                          </div>
                          <div className="truncate text-foreground font-medium" title={row.newVideoFile}>
                            {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                          </div>
                        </div>
                      ) : (
                        <div className="truncate" title={row.videoFile}>
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      )
                    ) : preview === 'recognize' ? (
                      previewStatus === 'loading' ? (
                        <span className="text-muted-foreground text-xs"><Spinner className="size-4" /></span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t('tvShowEpisodeTable.unrecognizedVideoFile', { defaultValue: 'Cannot recognize video file' })}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {isSimpleLayout && showThumbnailColumn && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    {row.thumbnail ? (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center justify-center cursor-default">
                            <CheckCell value={row.thumbnail} />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="center"
                          className="w-auto max-w-[320px] p-1"
                        >
                          <ThumbnailImage
                            thumbnailPath={row.thumbnail}
                            mediaFolderPath={mediaFolderPath}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <CheckCell value={row.thumbnail} />
                    )}
                  </TableCell>
                )}
                {!isSimpleLayout && showThumbnailColumn && (
                  <TableCell
                    className={cn(
                      isPreviewLayout && "w-[160px] min-w-[160px] px-1 py-1 align-top",
                      layout === "detail" && !isPreviewLayout && "w-[100px] min-w-[100px] px-1 py-1 align-top"
                    )}
                  >
                    {isPreviewLayout ? (
                      row.thumbnail ? (
                        <ThumbnailImage
                          thumbnailPath={row.thumbnail}
                          mediaFolderPath={mediaFolderPath}
                          className="max-h-[140px] w-auto rounded object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )
                    ) : layout === "detail" ? (
                      row.thumbnail ? (
                        <ThumbnailImage
                          thumbnailPath={row.thumbnail}
                          mediaFolderPath={mediaFolderPath}
                          className="max-h-[72px] w-auto rounded object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )
                    ) : row.thumbnail ? (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center justify-center cursor-default">
                            <CheckCell value={row.thumbnail} />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="center"
                          className="w-auto max-w-[320px] p-1"
                        >
                          <ThumbnailImage
                            thumbnailPath={row.thumbnail}
                            mediaFolderPath={mediaFolderPath}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <CheckCell value={row.thumbnail} />
                    )}
                  </TableCell>
                )}
                {!isSimpleLayout && columnVisibility.video && (
                  <TableCell className="max-w-px px-2 py-1">
                    {isPreviewLayout ? (
                      <div className="min-w-0 space-y-2">
                        <div className="truncate font-medium text-foreground" title={`${row.season}-${row.episode} ${row.episodeTitle || ""}`.trim()}>
                          {`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`} {row.episodeTitle ? `· ${row.episodeTitle}` : ""}
                        </div>
                        {row.videoFile ? (
                          <>
                            <div className="truncate text-muted-foreground text-xs" title={row.videoFile}>
                              {getDisplayPath(row.videoFile, mediaFolderPath)}
                            </div>
                            <EpisodeVideoScreenshot
                              videoPath={row.videoFile}
                              mediaFolderPath={mediaFolderPath}
                              folderAbortSignal={folderAbortSignal}
                            />
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    ) : layout === "detail" ? (
                      <div className="min-w-0 space-y-0.5">
                        <div className="truncate font-medium text-foreground" title={row.episodeTitle || `${row.season}-${row.episode}`}>
                          {row.episodeTitle || `S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}` || "-"}
                        </div>
                        {row.videoFile ? (
                          preview === 'rename' && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
                            <>
                              <div className="truncate text-muted-foreground/60 line-through text-xs" title={row.videoFile}>
                                {getDisplayPath(row.videoFile, mediaFolderPath)}
                              </div>
                              <div className="truncate text-foreground text-xs" title={row.newVideoFile}>
                                {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                              </div>
                            </>
                          ) : (
                            <div className="truncate text-muted-foreground text-xs" title={row.videoFile}>
                              {getDisplayPath(row.videoFile, mediaFolderPath)}
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    ) : row.videoFile ? (
                      preview === 'rename' && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
                        <div className="min-w-0 space-y-0.5">
                          <div className="truncate text-muted-foreground/60 line-through text-xs" title={row.videoFile}>
                            {getDisplayPath(row.videoFile, mediaFolderPath)}
                          </div>
                          <div className="truncate text-foreground font-medium" title={row.newVideoFile}>
                            {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                          </div>
                        </div>
                      ) : (
                        <div className="truncate" title={row.videoFile}>
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {columnVisibility.subtitle && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    <CheckCell value={row.subtitle} />
                  </TableCell>
                )}
                {columnVisibility.nfo && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    <CheckCell value={row.nfo} />
                  </TableCell>
                )}
              </TableRow>
            )

            return (
              <ContextMenu key={`${row.season}-${row.episode}-${index}`}>
                <ContextMenuTrigger asChild>
                  {episodeRow}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    disabled={!row.videoFile}
                    onClick={() => {
                      if (!row.videoFile) return
                      const absolutePath = mediaFolderPath && !isAbsPath(row.videoFile) ? join(mediaFolderPath, row.videoFile) : row.videoFile
                      const platformPath = Path.toPlatformPath(absolutePath)
                      openFile(platformPath).catch((error) => {
                        console.error('[TvShowEpisodeTable] Failed to open file:', error)
                      })
                    }}
                  >
                    {t('episodeFile.open', { ns: 'components' })}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!row.videoFile || !mediaFolderPath || !selectedMediaMetadata}
                    onClick={() => {
                      if (!row.videoFile || !mediaFolderPath || !selectedMediaMetadata?.mediaFolderPath) return
                      let relativePath: string
                      try {
                        relativePath = relative(mediaFolderPath, row.videoFile)
                      } catch {
                        relativePath = row.videoFile
                      }
                      openRename(
                        async (newRelativePath: string) => {
                          if (!selectedMediaMetadata?.mediaFolderPath || !row.videoFile) return
                          try {
                            const newAbsolutePath = join(selectedMediaMetadata.mediaFolderPath, newRelativePath)
                            const allMediaFiles = selectedMediaMetadata.files ?? []
                            const assocRenames = computeAssociatedFileRenames(row.videoFile, newAbsolutePath, allMediaFiles)
                            await renameFiles({
                              files: [
                                { from: row.videoFile, to: newAbsolutePath },
                                ...assocRenames,
                              ],
                            })
                            refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)
                            toast.success(t('episodeFile.renameSuccess', { ns: 'components' }))
                          } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : t('episodeFile.renameFailed', { ns: 'components' })
                            toast.error(t('episodeFile.renameFailed', { ns: 'components' }), {
                              description: errorMessage,
                            })
                            throw error
                          }
                        },
                        {
                          initialValue: relativePath,
                          title: t('dialogs:rename.title'),
                          description: t('dialogs:rename.fileDescription'),
                        }
                      )
                    }}
                  >
                    {t('episodeFile.rename', { ns: 'components' })}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!row.videoFile || !onEditTags}
                    onClick={() => onEditTags?.(row)}
                  >
                    {t('tvShowEpisodeTable.contextMenu.editTags')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!onVideoFileSelect}
                    onClick={() => {
                      onVideoFileSelect?.(row)
                    }}
                  >
                    {t('episodeFile.selectFile', { ns: 'components' })}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!row.videoFile || !onUnlinkEpisode}
                    onClick={() => {
                      onUnlinkEpisode?.(row)
                    }}
                  >
                    {t('tvShowEpisodeTable.contextMenu.unlink')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
