import { basename, relative, join } from "@/lib/path"
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
import { CheckIcon, MinusIcon } from "lucide-react"
import { useState } from "react"
import { useDialogs } from "@/providers/dialog-provider"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { computeAssociatedFileRenames } from "../episode-file"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata/useMediaMetadataQuery"

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
  /** Called when user chooses "Video Compression" from the context menu of the video row. */
  onVideoCompressClick?: (filePath: string) => void
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

const COLUMN_KEYS = ["file", "thumbnail", "subtitle", "nfo"] as const
type ColumnKey = (typeof COLUMN_KEYS)[number]

const getColumnLabels = (t: (key: string, options?: Record<string, unknown>) => string): Record<ColumnKey, string> => ({
  file: t("movieEpisodeTable.columns.file"),
  thumbnail: t("movieEpisodeTable.columns.thumbnail"),
  subtitle: t("movieEpisodeTable.columns.subtitle"),
  nfo: t("movieEpisodeTable.columns.nfo"),
})

const defaultColumnVisibility: Record<ColumnKey, boolean> = {
  file: true,
  thumbnail: true,
  subtitle: true,
  nfo: true,
}

export function MovieEpisodeTable({ data, mediaFolderPath, preview, onVideoCompressClick }: MovieEpisodeTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(defaultColumnVisibility)
  const { t } = useTranslation(["components", "dialogs"])
  const columnLabels = getColumnLabels(t as (key: string, options?: Record<string, unknown>) => string)
  const { selectedFolder } = useUIMediaFolderStoreState()
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined)
  const { mutate: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const { renameFileDialog } = useDialogs()
  const [openRename] = renameFileDialog

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const visibleColumnCount = 1 + COLUMN_KEYS.filter((k) => columnVisibility[k]).length

  const headerRow = (
    <TableRow className="hover:bg-transparent">
      <TableHead className="h-8 w-[80px] px-2 py-1">{t("movieEpisodeTable.header.type")}</TableHead>
      {columnVisibility.file && (
        <TableHead className="h-8 min-w-0 px-2 py-1">{t("movieEpisodeTable.header.file")}</TableHead>
      )}
      {columnVisibility.thumbnail && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title={t("movieEpisodeTable.header.poster")}>
          {t("movieEpisodeTable.header.poster")}
        </TableHead>
      )}
      {columnVisibility.subtitle && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title={t("movieEpisodeTable.columns.subtitle")}>
          {t("movieEpisodeTable.header.sub")}
        </TableHead>
      )}
      {columnVisibility.nfo && (
        <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap">{t("movieEpisodeTable.header.nfo")}</TableHead>
      )}
    </TableRow>
  )

  // Group rows by type for display
  const videoRow = data.find((row) => row.type === "video")
  const posterForVideo = data.find((row) => row.type === "poster")
  const subtitleRows = data.filter((row) => row.type === "subtitle")
  const nfoForVideo = data.find((row) => row.type === "nfo")

  return (
    <section className="bg-card">
      <Table className="text-xs table-fixed w-full" data-testid="movie-episode-table">
        <TableHeader>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              {headerRow}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuSub>
                <ContextMenuSubTrigger>{t("movieEpisodeTable.contextMenu.showColumns")}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.file}
                    onCheckedChange={() => toggleColumn("file")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.file}
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
          {/* Video Row */}
          {videoRow && columnVisibility.file && (
            <ContextMenu key="video-row">
              <ContextMenuTrigger asChild>
                <TableRow>
                  <TableCell className="px-2 py-1 font-mono">{t("movieEpisodeTable.rowTypes.video")}</TableCell>
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
                      <CheckCell value={posterForVideo?.file} />
                    </TableCell>
                  )}
                  {columnVisibility.subtitle && (
                    <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                      <CheckCell value={subtitleRows[0]?.file} />
                    </TableCell>
                  )}
                  {columnVisibility.nfo && (
                    <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                      <CheckCell value={nfoForVideo?.file} />
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
                          fetchMediaMetadata({ path: selectedMediaMetadata.mediaFolderPath })
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
                {onVideoCompressClick && (
                <ContextMenuItem
                  disabled={!videoRow.file}
                  onClick={() => videoRow.file && onVideoCompressClick(videoRow.file)}
                >
                  {t('movieEpisodeTable.contextMenu.videoCompress')}
                </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )}

          {/* Subtitle Rows — associated files of the video, listed in file column */}
          {subtitleRows.map((row, index) => columnVisibility.file && (
            <TableRow key={`subtitle-row-${index}`}>
              <TableCell className="px-2 py-1 font-mono">{t("movieEpisodeTable.rowTypes.sub")}</TableCell>
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
                  <CheckCell value={undefined} />
                </TableCell>
              )}
              {columnVisibility.nfo && (
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={undefined} />
                </TableCell>
              )}
            </TableRow>
          ))}

          {/* Empty state */}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={visibleColumnCount} className="text-center py-6 text-muted-foreground">
                {t("movieEpisodeTable.noFilesFound")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  )
}
