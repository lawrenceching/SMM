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
import { CheckIcon, MinusIcon } from "lucide-react"
import Image from "@/components/Image"
import { useState, useMemo } from "react"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { computeAssociatedFileRenames } from "./episode-file"

export interface MovieFileRow {
  id: string
  type: "video" | "subtitle" | "poster" | "nfo" | "audio" | "file"
  file: string | undefined
  /** Preview target path (used when preview mode is active) */
  newFile?: string
}

interface MovieEpisodeTableProps {
  data: MovieFileRow[]
  /** When set, file paths are shown relative to this path. */
  mediaFolderPath?: string
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

/** Builds a file:// URL for the poster that the backend can resolve (platform path → file URL). */
function getPosterImageUrl(posterPath: string, mediaFolderPath: string | undefined): string {
  const absolutePath =
    mediaFolderPath && !isAbsPath(posterPath)
      ? join(mediaFolderPath, posterPath)
      : posterPath
  const platformPath = Path.toPlatformPath(absolutePath)
  const url = pathToFileURL(platformPath)
  if (import.meta.env.DEV) {
    console.debug("[MovieEpisodeTable] poster image url", {
      posterPath,
      absolutePath,
      platformPath,
      url,
    })
  }
  return url
}

function PosterImage({
  posterPath,
  mediaFolderPath,
}: {
  posterPath: string
  mediaFolderPath: string | undefined
}) {
  const url = getPosterImageUrl(posterPath, mediaFolderPath)
  return (
    <Image
      url={url}
      alt=""
      className="max-h-[240px] w-auto rounded object-contain"
    />
  )
}

const COLUMN_KEYS = ["file", "thumbnail", "subtitle", "nfo"] as const
type ColumnKey = (typeof COLUMN_KEYS)[number]

const COLUMN_LABELS: Record<ColumnKey, string> = {
  file: "文件",
  thumbnail: "封面",
  subtitle: "字幕",
  nfo: "NFO",
}

const defaultColumnVisibility: Record<ColumnKey, boolean> = {
  file: true,
  thumbnail: true,
  subtitle: true,
  nfo: true,
}

export function MovieEpisodeTable({ data, mediaFolderPath, preview }: MovieEpisodeTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(defaultColumnVisibility)
  const { t } = useTranslation(['components', 'dialogs'])
  const { selectedMediaMetadata } = useMediaMetadataStoreState()
  const { refreshMediaMetadata } = useMediaMetadataActions()
  const { renameDialog } = useDialogs()
  const [openRename] = renameDialog

  console.log("[MovieEpisodeTable] render", { dataLength: data.length })

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const visibleColumnCount = 1 + COLUMN_KEYS.filter((k) => columnVisibility[k]).length

  const headerRow = (
    <TableRow className="hover:bg-transparent">
      <TableHead className="h-8 w-[80px] px-2 py-1">Type</TableHead>
      {columnVisibility.file && (
        <TableHead className="h-8 min-w-0 px-2 py-1">File</TableHead>
      )}
      {columnVisibility.thumbnail && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title="Poster">Poster</TableHead>
      )}
      {columnVisibility.subtitle && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title="Subtitle">Sub</TableHead>
      )}
      {columnVisibility.nfo && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap">NFO</TableHead>
      )}
    </TableRow>
  )

  // Group rows by type for display
  const videoRow = data.find((row) => row.type === "video")
  const posterRow = data.find((row) => row.type === "poster")
  const subtitleRows = data.filter((row) => row.type === "subtitle")
  const nfoRow = data.find((row) => row.type === "nfo")

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
                <ContextMenuSubTrigger>显示...</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.file}
                    onCheckedChange={() => toggleColumn("file")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {COLUMN_LABELS.file}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.thumbnail}
                    onCheckedChange={() => toggleColumn("thumbnail")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {COLUMN_LABELS.thumbnail}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.subtitle}
                    onCheckedChange={() => toggleColumn("subtitle")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {COLUMN_LABELS.subtitle}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.nfo}
                    onCheckedChange={() => toggleColumn("nfo")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {COLUMN_LABELS.nfo}
                  </ContextMenuCheckboxItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        </TableHeader>
        <TableBody>
          {/* Video Row */}
          {videoRow && columnVisibility.file && (
            <ContextMenu key="video-row">
              <ContextMenuTrigger asChild>
                <TableRow>
                  <TableCell className="px-2 py-1 font-mono">Video</TableCell>
                  <TableCell className="max-w-px px-2 py-1">
                    {videoRow.file ? (
                      preview && videoRow.newFile && basename(videoRow.file) !== basename(videoRow.newFile) ? (
                        <div className="min-w-0 space-y-0.5">
                          <div className="truncate text-muted-foreground/60 line-through text-xs" title={videoRow.file}>
                            {getDisplayPath(videoRow.file, mediaFolderPath)}
                          </div>
                          <div className="truncate text-foreground font-medium" title={videoRow.newFile}>
                            {getDisplayPath(videoRow.newFile, mediaFolderPath)}
                          </div>
                        </div>
                      ) : (
                        <div className="truncate" title={videoRow.file}>
                          {getDisplayPath(videoRow.file, mediaFolderPath)}
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {columnVisibility.thumbnail && (
                    <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                      <CheckCell value={posterRow?.file} />
                    </TableCell>
                  )}
                  {columnVisibility.subtitle && (
                    <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                      <CheckCell value={subtitleRows[0]?.file} />
                    </TableCell>
                  )}
                  {columnVisibility.nfo && (
                    <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                      <CheckCell value={nfoRow?.file} />
                    </TableCell>
                  )}
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  disabled={!videoRow.file || !mediaFolderPath || !selectedMediaMetadata}
                  onClick={() => {
                    if (!videoRow.file || !mediaFolderPath || !selectedMediaMetadata?.mediaFolderPath) return
                    let relativePath: string
                    try {
                      relativePath = relative(mediaFolderPath, videoRow.file)
                    } catch {
                      relativePath = videoRow.file
                    }
                    openRename(
                      async (newRelativePath: string) => {
                        if (!selectedMediaMetadata?.mediaFolderPath || !videoRow.file) return
                        try {
                          const newAbsolutePath = join(selectedMediaMetadata.mediaFolderPath, newRelativePath)
                          const allMediaFiles = selectedMediaMetadata.files ?? []
                          const assocRenames = computeAssociatedFileRenames(videoRow.file, newAbsolutePath, allMediaFiles)
                          await renameFiles({
                            files: [
                              { from: videoRow.file, to: newAbsolutePath },
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
              </ContextMenuContent>
            </ContextMenu>
          )}

          {/* Poster Row (only if exists and thumbnail column is visible) */}
          {posterRow?.file && columnVisibility.thumbnail && (
            <TableRow key="poster-row">
              <TableCell className="px-2 py-1 font-mono">Poster</TableCell>
              {columnVisibility.file && (
                <TableCell className="max-w-px px-2 py-1">
                  <div className="truncate" title={posterRow.file}>
                    {getDisplayPath(posterRow.file, mediaFolderPath)}
                  </div>
                </TableCell>
              )}
              <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div className="flex items-center justify-center cursor-default">
                      <CheckCell value={posterRow.file} />
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="center"
                    className="w-auto max-w-[320px] p-1"
                  >
                    <PosterImage
                      posterPath={posterRow.file}
                      mediaFolderPath={mediaFolderPath}
                    />
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              {columnVisibility.subtitle && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
              {columnVisibility.nfo && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
            </TableRow>
          )}

          {/* Subtitle Rows (only if exist and subtitle column is visible) */}
          {subtitleRows.map((row, index) => columnVisibility.file && (
            <TableRow key={`subtitle-row-${index}`}>
              <TableCell className="px-2 py-1 font-mono">Sub</TableCell>
              <TableCell className="max-w-px px-2 py-1">
                <div className="truncate" title={row.file || ""}>
                  {row.file ? getDisplayPath(row.file, mediaFolderPath) : <span className="text-muted-foreground">-</span>}
                </div>
              </TableCell>
              {columnVisibility.thumbnail && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
              {columnVisibility.subtitle && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={row.file} />
                </TableCell>
              )}
              {columnVisibility.nfo && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
            </TableRow>
          ))}

          {/* NFO Row (only if exists and nfo column is visible) */}
          {nfoRow?.file && columnVisibility.nfo && (
            <TableRow key="nfo-row">
              <TableCell className="px-2 py-1 font-mono">NFO</TableCell>
              {columnVisibility.file && (
                <TableCell className="max-w-px px-2 py-1">
                  <div className="truncate" title={nfoRow.file}>
                    {getDisplayPath(nfoRow.file, mediaFolderPath)}
                  </div>
                </TableCell>
              )}
              {columnVisibility.thumbnail && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
              {columnVisibility.subtitle && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
              <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                <CheckCell value={nfoRow.file} />
              </TableCell>
            </TableRow>
          )}

          {/* Empty state */}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColumnCount} className="text-center py-6 text-muted-foreground">
                No files found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
