import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Music } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import {
  emitTrackOpenEvent,
  emitTrackDeleteEvent,
  emitTrackPropertiesEvent,
  emitTrackFormatConvertEvent,
  emitTrackEditTagsEvent,
} from "@/lib/musicEvents"
import { MusicFileTableRow } from "./MusicFileTableRow"
import type { MusicFileRow } from "./MusicFileTableRow"

export type { MusicFileRow } from "./MusicFileTableRow"

interface MusicFileTableProps {
  data: MusicFileRow[]
  /** When set, paths are shown relative to this path. */
  mediaFolderPath?: string
  /** Currently playing track ID */
  currentTrackId?: number | null
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Called when a track is clicked to play */
  onTrackClick?: (trackId: number) => void
  /** Whether a download job is currently running (disables "Start" menu) */
  hasRunningDownload?: boolean
  /** Start a pending/stopped/failed download job */
  onDownloadStart?: (jobId: string) => void
  /** Stop a running download job */
  onDownloadStop?: (jobId: string) => void
  /** Remove a download job */
  onDownloadRemove?: (jobId: string) => void
  /** Whether videocaptioner is available for transcribing */
  isTranscribeAvailable?: boolean
  /** Trigger transcribe for a track path */
  onTrackTranscribe?: (track: MusicFileRow) => void
  /** Stop an in-progress transcribe job for this row's file */
  onTranscribeStop?: (track: MusicFileRow) => void
  /** VideoCaptioner translate API is available */
  isTranslateAvailable?: boolean
  /** Open translate dialog scoped to this row */
  onTrackTranslate?: (track: MusicFileRow) => void
  /** Stop an in-progress translate job for this row */
  onTranslateStop?: (track: MusicFileRow) => void
  /** VideoCaptioner synthesize is available */
  isSynthesizeAvailable?: boolean
  onTrackSynthesize?: (track: MusicFileRow) => void
  onSynthesizeStop?: (track: MusicFileRow) => void
  /** VideoCaptioner process pipeline is available (bundled tool ready + feature enabled). */
  isProcessAvailable?: boolean
  onTrackProcess?: (track: MusicFileRow) => void
  onProcessStop?: (track: MusicFileRow) => void
  /** Whether table is in multi-select mode */
  isMultiSelectMode?: boolean
  /** Selected track ids in multi-select mode */
  selectedTrackIds?: number[]
  /** Callback when selected track ids change */
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

export function MusicFileTable({
  data,
  mediaFolderPath,
  currentTrackId,
  isPlaying,
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

  const handleOpen = (track: MusicFileRow) => {
    if (!track.path) return
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

  const handleDelete = (track: MusicFileRow) => {
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

  const toTrack = (track: MusicFileRow) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    thumbnail: track.thumbnail,
    addedDate: new Date(),
    path: track.path,
  })

  const handleProperties = (track: MusicFileRow) => {
    emitTrackPropertiesEvent(toTrack(track))
  }

  const handleFormatConvert = (track: MusicFileRow) => {
    emitTrackFormatConvertEvent(toTrack(track))
  }

  const handleEditTags = (track: MusicFileRow) => {
    emitTrackEditTagsEvent(toTrack(track))
  }

  return (
    <section className="bg-card">
      <Table className="w-full table-fixed text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {isMultiSelectMode && (
              <TableHead
                className="h-8 w-10 px-2 py-1 text-center"
                data-testid="music-file-table-selection-header"
              />
            )}
            <TableHead className="h-8 w-10 px-2 py-1 text-center">{t("musicFileTable.columns.index")}</TableHead>
            <TableHead className="h-8 w-16 px-0 py-1 text-center">{t("musicFileTable.columns.cover")}</TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">{t("musicFileTable.columns.title")}</TableHead>
            <TableHead className="h-8 w-32 px-2 py-1">{t("musicFileTable.columns.artist")}</TableHead>
            <TableHead className="h-8 w-16 px-2 py-1 text-right">{t("musicFileTable.columns.duration")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isMultiSelectMode ? 6 : 5} className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Music className="size-8 text-muted-foreground/50" />
                  <p>{t("mediaPlayer.noTracksFound")}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <MusicFileTableRow
                key={row.id}
                row={row}
                mediaFolderPath={mediaFolderPath}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onTrackClick={onTrackClick}
                hasRunningDownload={hasRunningDownload}
                onDownloadStart={onDownloadStart}
                onDownloadStop={onDownloadStop}
                onDownloadRemove={onDownloadRemove}
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
                isMultiSelectMode={isMultiSelectMode}
                selectedTrackIds={selectedTrackIds}
                onSelectedTrackIdsChange={onSelectedTrackIdsChange}
                onTrackOpen={handleOpen}
                onTrackDelete={handleDelete}
                onTrackProperties={handleProperties}
                onTrackFormatConvert={handleFormatConvert}
                onTrackEditTags={handleEditTags}
              />
            ))
          )}
        </TableBody>
      </Table>
    </section>
  )
}
