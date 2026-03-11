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
import { useState, useMemo, useEffect } from "react"
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
  id: string
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
}

export type TvShowEpisodeTableRow = TvShowEpisodeDividerRow | TvShowEpisodeDataRow

interface TvShowEpisodeTableProps {
  data: TvShowEpisodeTableRow[]
  /** When set, video paths are shown relative to this path. */
  mediaFolderPath?: string
  /** Called when user chooses "Select File" from context menu; rowId is e.g. "S01E01". */
  onVideoFileSelect?: (rowId: string) => void
  /** Called when user chooses "Unlink" from context menu; rowId is e.g. "S01E01". */
  onUnlinkEpisode?: (rowId: string) => void
  /** When true, shows rename preview with strikethrough old name and new name. */
  preview?: boolean
  /** Table layout: simple | detail (cover + title + path) | preview (no ID, larger cover, video screenshot). */
  layout?: "simple" | "detail" | "preview"
}

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

/** Fetches and displays video screenshots (multiple) for a video file path. */
function EpisodeVideoScreenshot({
  videoPath,
  mediaFolderPath,
  className,
}: {
  videoPath: string
  mediaFolderPath: string | undefined
  className?: string
}) {
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!videoPath) {
      setScreenshots([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    const absolutePath =
      mediaFolderPath && !isAbsPath(videoPath) ? join(mediaFolderPath, videoPath) : videoPath
    const posixPath = Path.posix(absolutePath)

    enqueueScreenshotTask(async () => {
      try {
        const result = await generateFfmpegScreenshots(posixPath)
        if (cancelled) return
        if (result.screenshots && result.screenshots.length > 0) {
          setScreenshots(result.screenshots)
        } else {
          setScreenshots([])
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setScreenshots([])
        }
      } finally {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [videoPath, mediaFolderPath])

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
          "flex items-center justify-center rounded bg-muted aspect-video min-h-[60px]",
          className
        )}
      >
        <Video className="size-8 text-muted-foreground" />
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

export function TvShowEpisodeTable({ data, mediaFolderPath, onVideoFileSelect, onUnlinkEpisode, preview, layout = "simple" }: TvShowEpisodeTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(defaultColumnVisibility)
  const { t } = useTranslation(['components', 'dialogs'])
  const { selectedMediaMetadata } = useMediaMetadataStoreState()
  const { refreshMediaMetadata } = useMediaMetadataActions()
  const { renameDialog } = useDialogs()
  const [openRename] = renameDialog

  const columnLabels = getColumnLabels(t as (key: string, options?: Record<string, unknown>) => string)

  console.log("[TvShowEpisodeTable] render", { dataLength: data.length, firstRowId: data[0]?.id ?? "(empty)" })

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
  const visibleColumnCount =
    (showIdColumn ? 1 : 0) +
    (showThumbnailColumn ? 1 : 0) +
    (columnVisibility.video ? 1 : 0) +
    (columnVisibility.subtitle ? 1 : 0) +
    (columnVisibility.nfo ? 1 : 0)

  const thumbnailCellWidth = isPreviewLayout ? "w-[160px] min-w-[160px]" : layout === "detail" ? "w-[100px] min-w-[100px]" : ""

  const headerRow = (
    <TableRow className="hover:bg-transparent">
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
    <section className="bg-card">
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
                  <TableCell colSpan={visibleColumnCount} className="px-2 py-1.5 font-semibold">
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

            const sectionId = sectionIdByIndex.get(index)
            if (sectionId && collapsedIds.has(sectionId)) {
              return null
            }

            const episodeRow = (
              <TableRow key={`${row.id}-${index}`}>
                {showIdColumn && (
                  <TableCell className="px-2 py-1 font-mono">{row.id}</TableCell>
                )}
                {isSimpleLayout && columnVisibility.video && (
                  <TableCell className="max-w-px px-2 py-1">
                    {row.videoFile ? (
                      preview && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
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
                      layout === "detail" && !isPreviewLayout && "w-[100px] min-w-[100px] px-1 py-1 align-top",
                      !isPreviewLayout && layout === "simple" && "w-10 shrink-0 px-0 py-1 text-center"
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
                        <div className="truncate font-medium text-foreground" title={`${row.id} ${row.episodeTitle || ""}`.trim()}>
                          {row.id} {row.episodeTitle ? `· ${row.episodeTitle}` : ""}
                        </div>
                        {row.videoFile ? (
                          <>
                            <div className="truncate text-muted-foreground text-xs" title={row.videoFile}>
                              {getDisplayPath(row.videoFile, mediaFolderPath)}
                            </div>
                            <EpisodeVideoScreenshot
                              videoPath={row.videoFile}
                              mediaFolderPath={mediaFolderPath}
                            />
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    ) : layout === "detail" ? (
                      <div className="min-w-0 space-y-0.5">
                        <div className="truncate font-medium text-foreground" title={row.episodeTitle || row.id}>
                          {row.episodeTitle || row.id || "-"}
                        </div>
                        {row.videoFile ? (
                          preview && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
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
                      preview && row.newVideoFile && basename(row.videoFile) !== basename(row.newVideoFile) ? (
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
              <ContextMenu key={`${row.id}-${index}`}>
                <ContextMenuTrigger asChild>
                  {episodeRow}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    disabled={!row.videoFile}
                    onClick={() => {
                      if (!row.videoFile) return
                      const absolutePath = mediaFolderPath && !isAbsPath(row.videoFile) ? join(mediaFolderPath, row.videoFile) : row.videoFile
                      openFile(absolutePath).catch((error) => {
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
                    disabled={!onVideoFileSelect}
                    onClick={() => {
                      onVideoFileSelect?.(row.id)
                    }}
                  >
                    {t('episodeFile.selectFile', { ns: 'components' })}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!row.videoFile || !onUnlinkEpisode}
                    onClick={() => {
                      onUnlinkEpisode?.(row.id)
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
