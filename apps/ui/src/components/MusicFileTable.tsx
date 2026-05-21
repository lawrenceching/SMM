import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Music } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "@/lib/i18n"
import {
  emitTrackOpenEvent,
  emitTrackDeleteEvent,
  emitTrackPropertiesEvent,
  emitTrackFormatConvertEvent,
  emitTrackEditTagsEvent,
} from "@/lib/musicEvents"
import { LocalFileTableRow } from "./LocalFileTableRow"
import { JobTableRow } from "./JobTableRow"

export interface LocalFileTableRowData {
  kind: "local"
  id: number
  index: number
  path: string
  title: string
  artist: string
  duration: number
  thumbnail?: string
  transcribeStatus?: "running" | "failed"
  translateStatus?: "running" | "failed"
  synthesizeStatus?: "running" | "failed"
  processStatus?: "running" | "failed"
  canProcess?: boolean
  canTranslate?: boolean
  canSynthesize?: boolean
}

export type JobTableRowStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed"
  | "stopped"

export interface JobTableRowData {
  kind: "job"
  id: number
  index: number
  jobId: string
  status: JobTableRowStatus
  title: string
  artist: string
  duration: number
  thumbnail?: string
}

export type MusicTableRow = LocalFileTableRowData | JobTableRowData

interface MusicFileTableProps {
  data: MusicTableRow[]
  mediaFolderPath?: string
  currentTrackId?: number | null
  isPlaying?: boolean
  onTrackClick?: (trackId: number) => void
  hasRunningDownload?: boolean
  onDownloadStart?: (jobId: string) => void
  onDownloadStop?: (jobId: string) => void
  onDownloadRemove?: (jobId: string) => void
  isTranscribeAvailable?: boolean
  onTrackTranscribe?: (track: LocalFileTableRowData) => void
  onTranscribeStop?: (track: LocalFileTableRowData) => void
  isTranslateAvailable?: boolean
  onTrackTranslate?: (track: LocalFileTableRowData) => void
  onTranslateStop?: (track: LocalFileTableRowData) => void
  isSynthesizeAvailable?: boolean
  onTrackSynthesize?: (track: LocalFileTableRowData) => void
  onSynthesizeStop?: (track: LocalFileTableRowData) => void
  isProcessAvailable?: boolean
  onTrackProcess?: (track: LocalFileTableRowData) => void
  onProcessStop?: (track: LocalFileTableRowData) => void
  isMultiSelectMode?: boolean
  selectedTrackIds?: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

export function MusicFileTable({
  data,
  mediaFolderPath,
  onTrackClick,
  hasRunningDownload,
  onDownloadStart,
  onDownloadStop,
  onDownloadRemove,
  isTranscribeAvailable,
  onTrackTranscribe,
  onTranscribeStop,
  isTranslateAvailable,
  onTrackTranslate,
  onTranslateStop,
  isSynthesizeAvailable,
  onTrackSynthesize,
  onSynthesizeStop,
  isProcessAvailable,
  onTrackProcess,
  onProcessStop,
  isMultiSelectMode = false,
  selectedTrackIds = [],
  onSelectedTrackIdsChange,
}: MusicFileTableProps) {
  const { t } = useTranslation(["components"])
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const allRowIds = useMemo(() => data.map((row) => row.id), [data])
  const allSelected =
    data.length > 0 && allRowIds.every((id) => selectedTrackIds.includes(id))
  const someSelected = selectedTrackIds.length > 0 && !allSelected

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = isMultiSelectMode && someSelected
  }, [isMultiSelectMode, someSelected])

  const toggleSelectAll = useCallback(() => {
    if (!onSelectedTrackIdsChange) return
    onSelectedTrackIdsChange(allSelected ? [] : allRowIds)
  }, [allSelected, allRowIds, onSelectedTrackIdsChange])

  const handleOpen = (track: LocalFileTableRowData) => {
    emitTrackOpenEvent({
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      thumbnail: track.thumbnail,
      addedDate: new Date(),
      path: track.path,
    })
  }

  const handleDelete = (track: LocalFileTableRowData) => {
    emitTrackDeleteEvent({
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      thumbnail: track.thumbnail,
      addedDate: new Date(),
      path: track.path,
    })
  }

  const toTrack = (track: LocalFileTableRowData) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    thumbnail: track.thumbnail,
    addedDate: new Date(),
    path: track.path,
  })

  const handleProperties = (track: LocalFileTableRowData) => {
    emitTrackPropertiesEvent(toTrack(track))
  }

  const handleFormatConvert = (track: LocalFileTableRowData) => {
    emitTrackFormatConvertEvent(toTrack(track))
  }

  const handleEditTags = (track: LocalFileTableRowData) => {
    emitTrackEditTagsEvent(toTrack(track))
  }

  const selectionProps = {
    isMultiSelectMode,
    selectedTrackIds,
    onSelectedTrackIdsChange,
  }

  return (
    <section className="bg-card">
      <Table className="w-full table-fixed text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-10 px-2 py-1 text-center">
              {isMultiSelectMode ? (
                <div className="flex items-center justify-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={allSelected}
                    disabled={data.length === 0}
                    onChange={toggleSelectAll}
                    data-testid="music-file-table-select-all"
                    aria-label={t("musicFileTable.selectAllAria")}
                  />
                </div>
              ) : (
                t("musicFileTable.columns.index")
              )}
            </TableHead>
            <TableHead className="h-8 w-16 px-0 py-1 text-center">{t("musicFileTable.columns.cover")}</TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">{t("musicFileTable.columns.title")}</TableHead>
            <TableHead className="h-8 w-32 px-2 py-1">{t("musicFileTable.columns.artist")}</TableHead>
            <TableHead className="h-8 w-16 px-2 py-1 text-right">{t("musicFileTable.columns.duration")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Music className="size-8 text-muted-foreground/50" />
                  <p>{t("mediaPlayer.noTracksFound")}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) =>
              row.kind === "local" ? (
                <LocalFileTableRow
                  key={row.id}
                  row={row}
                  mediaFolderPath={mediaFolderPath}
                  onTrackClick={onTrackClick}
                  isTranscribeAvailable={isTranscribeAvailable}
                  onTrackTranscribe={onTrackTranscribe}
                  onTranscribeStop={onTranscribeStop}
                  isTranslateAvailable={isTranslateAvailable}
                  onTrackTranslate={onTrackTranslate}
                  onTranslateStop={onTranslateStop}
                  isSynthesizeAvailable={isSynthesizeAvailable}
                  onTrackSynthesize={onTrackSynthesize}
                  onSynthesizeStop={onSynthesizeStop}
                  isProcessAvailable={isProcessAvailable}
                  onTrackProcess={onTrackProcess}
                  onProcessStop={onProcessStop}
                  onTrackOpen={handleOpen}
                  onTrackDelete={handleDelete}
                  onTrackProperties={handleProperties}
                  onTrackFormatConvert={handleFormatConvert}
                  onTrackEditTags={handleEditTags}
                  {...selectionProps}
                />
              ) : (
                <JobTableRow
                  key={row.id}
                  row={row}
                  mediaFolderPath={mediaFolderPath}
                  hasRunningDownload={hasRunningDownload}
                  onDownloadStart={onDownloadStart}
                  onDownloadStop={onDownloadStop}
                  onDownloadRemove={onDownloadRemove}
                  {...selectionProps}
                />
              ),
            )
          )}
        </TableBody>
      </Table>
    </section>
  )
}
