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
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon } from "lucide-react"
import Image from "@/components/Image"
import { useState, useMemo } from "react"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
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
  /** When true, shows rename preview with strikethrough old name and new name. */
  preview?: boolean
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
}: {
  thumbnailPath: string
  mediaFolderPath: string | undefined
}) {
  const url = getThumbnailImageUrl(thumbnailPath, mediaFolderPath)
  return (
    <Image
      url={url}
      alt=""
      className="max-h-[240px] w-auto rounded object-contain"
    />
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

export function TvShowEpisodeTable({ data, mediaFolderPath, onVideoFileSelect, preview }: TvShowEpisodeTableProps) {
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

  const visibleColumnCount = 1 + COLUMN_KEYS.filter((k) => columnVisibility[k]).length

  const headerRow = (
    <TableRow className="hover:bg-transparent">
      <TableHead className="h-8 w-[100px] px-2 py-1">{t('tvShowEpisodeTable.columns.id')}</TableHead>
      {columnVisibility.video && (
        <TableHead className="h-8 min-w-0 px-2 py-1">{t('tvShowEpisodeTable.header.videoFile')}</TableHead>
      )}
      {columnVisibility.thumbnail && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title={t('tvShowEpisodeTable.columns.thumbnail')}>{t('tvShowEpisodeTable.header.thumb')}</TableHead>
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
                <TableCell className="px-2 py-1 font-mono">{row.id}</TableCell>
                {columnVisibility.video && (
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
                {columnVisibility.thumbnail && (
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
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
