import { isAbsPath, join } from "@/lib/path"
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
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Play, FolderOpen, Trash2, FileText, Music, Tag, CirclePlay, CircleStop, CircleX, Clock, CheckCircle2, XCircle, Captions, Languages, FileVideo } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import Image from "@/components/Image"
import { useTranslation } from "@/lib/i18n"
import { emitTrackOpenEvent, emitTrackDeleteEvent, emitTrackPropertiesEvent, emitTrackFormatConvertEvent, emitTrackEditTagsEvent } from "@/lib/musicEvents"

export interface MusicFileRow {
  id: number
  index: number
  title: string
  artist: string
  duration: number
  thumbnail?: string
  path?: string
  status?: "pending" | "downloading" | "completed" | "failed" | "stopped"
  jobId?: string
  /** Subtitle generation task for this file (IndexedDB + Service Worker). */
  transcribeStatus?: "running" | "failed"
  /** Subtitle translation task for this row's media path (IndexedDB + Service Worker). */
  translateStatus?: "running" | "failed"
  /** Subtitle-to-video synthesis task for this row's media path. */
  synthesizeStatus?: "running" | "failed"
  /** Sibling `.srt`/`.ass` exists in the media folder (see {@link subtitleTranslationDialogRowsFromMusicFileRows}). */
  canTranslate?: boolean
  /** Video + sibling subtitle available for synthesize (see {@link synthesizeSubtitleDialogRowsFromMusicFileRows}). */
  canSynthesize?: boolean
}

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
  /** Whether table is in multi-select mode */
  isMultiSelectMode?: boolean
  /** Selected track ids in multi-select mode */
  selectedTrackIds?: number[]
  /** Callback when selected track ids change */
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Builds a file:// URL for the thumbnail that the backend can resolve. */
function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {
  // If it's already a URL (http/https/file), return as-is
  if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://') || thumbnailPath.startsWith('file://')) {
    return thumbnailPath
  }

  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  const url = pathToFileURL(platformPath)
  return url
}

function ThumbnailPreview({
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
      className="max-h-[180px] w-auto rounded object-contain"
    />
  )
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

  const toggleTrackSelection = (trackId: number) => {
    if (!isMultiSelectMode) return
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

  return (
    <section className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {isMultiSelectMode && (
              <TableHead
                className="h-8 w-10 px-2 py-1 text-center"
                data-testid="music-file-table-selection-header"
              />
            )}
            <TableHead className="h-8 w-10 px-2 py-1 text-center">{t('musicFileTable.columns.index')}</TableHead>
            <TableHead className="h-8 w-16 px-0 py-1 text-center">{t('musicFileTable.columns.cover')}</TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">{t('musicFileTable.columns.title')}</TableHead>
            <TableHead className="h-8 w-32 px-2 py-1">{t('musicFileTable.columns.artist')}</TableHead>
            <TableHead className="h-8 w-16 px-2 py-1 text-right">{t('musicFileTable.columns.duration')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isMultiSelectMode ? 6 : 5} className="text-center py-12 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Music className="size-8 text-muted-foreground/50" />
                  <p>{t('mediaPlayer.noTracksFound')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              const isActive = currentTrackId === row.id
              const isDownloading = row.status === 'downloading'
              const isTranscribing = row.transcribeStatus === 'running'
              const isTranslating = row.translateStatus === 'running'
              const isSynthesizing = row.synthesizeStatus === 'running'
              const translateDisabled =
                !row.path ||
                isDownloading ||
                !isTranslateAvailable ||
                !row.canTranslate ||
                isTranslating
              const synthesizeDisabled =
                !row.path ||
                isDownloading ||
                !isSynthesizeAvailable ||
                !row.canSynthesize ||
                isSynthesizing
              const transcribeItemDisabled =
                !row.path || isDownloading || !isTranscribeAvailable || isTranscribing
              const subtitleSubmenuDisabled =
                !(
                  (row.path && !isDownloading && row.transcribeStatus === 'running') ||
                  (row.path && !isDownloading && isTranscribeAvailable && !isTranscribing) ||
                  (row.path && !isDownloading && isTranslateAvailable && row.canTranslate && !isTranslating) ||
                  (row.path && !isDownloading && row.translateStatus === 'running') ||
                  (row.path && !isDownloading && isSynthesizeAvailable && row.canSynthesize && !isSynthesizing) ||
                  (row.path && !isDownloading && row.synthesizeStatus === 'running')
                )

              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={`cursor-pointer group ${isActive ? 'bg-muted' : ''}`}
                      onClick={() => {
                        if (isDownloading) return
                        if (isMultiSelectMode) {
                          toggleTrackSelection(row.id)
                          return
                        }
                        onTrackClick?.(row.id)
                      }}
                    >
                      {isMultiSelectMode && (
                        <TableCell className="w-10 px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTrackIds.includes(row.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleTrackSelection(row.id)}
                            data-testid={`music-file-row-checkbox-${row.id}`}
                            aria-label={`select-row-${row.id}`}
                          />
                        </TableCell>
                      )}
                      {/* Index / Play / Download status indicator */}
                      <TableCell className="w-10 px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center">
                          {row.jobId ? (
                            row.status === 'downloading' ? (
                              <Spinner className="size-4 text-blue-500" />
                            ) : row.status === 'completed' ? (
                              <CheckCircle2 className="size-4 text-green-500" />
                            ) : row.status === 'failed' ? (
                              <XCircle className="size-4 text-red-500" />
                            ) : row.status === 'stopped' ? (
                              <CircleStop className="size-4 text-orange-500" />
                            ) : (
                              <Clock className="size-4 text-muted-foreground" />
                            )
                          ) : isActive && isPlaying ? (
                            <div className="flex items-center justify-center gap-0.5 h-4">
                              {[0, 1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className="w-0.5 bg-green-500 rounded-full animate-pulse"
                                  style={{
                                    animationDelay: `${i * 0.15}s`,
                                    height: `${4 + Math.random() * 12}px`,
                                  }}
                                />
                              ))}
                            </div>
                          ) : isActive ? (
                            <Play className="size-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground group-hover:hidden">
                              {row.index + 1}
                            </span>
                          )}
                          {!row.jobId && !isActive && (
                            <Play className="size-4 text-foreground hidden group-hover:block" />
                          )}
                        </div>
                      </TableCell>

                      {/* Thumbnail */}
                      <TableCell className="w-16 px-0 py-1.5">
                        {row.thumbnail ? (
                          <HoverCard openDelay={200} closeDelay={100}>
                            <HoverCardTrigger asChild>
                              <div className="w-14 h-8 rounded overflow-hidden cursor-default mx-auto">
                                <Image
                                  url={getThumbnailImageUrl(row.thumbnail, mediaFolderPath)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="right"
                              align="center"
                              className="w-auto max-w-[240px] p-1"
                            >
                              <ThumbnailPreview
                                thumbnailPath={row.thumbnail}
                                mediaFolderPath={mediaFolderPath}
                              />
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <div className="w-14 h-8 rounded bg-muted flex items-center justify-center mx-auto">
                            <Music className="size-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </TableCell>

                      {/* Title */}
                      <TableCell className="min-w-0 px-2 py-1.5">
                        <p
                          className={`flex min-w-0 items-center gap-1.5 truncate ${isActive ? "text-green-500 font-medium" : ""}`}
                          title={
                            isTranslating
                              ? t("mediaPlayer.translateRunningTooltip")
                              : row.translateStatus === "failed" && !isTranslating
                                ? t("mediaPlayer.translateFailedTooltip")
                                : isSynthesizing
                                  ? t("mediaPlayer.synthesizeRunningTooltip")
                                  : row.synthesizeStatus === "failed" && !isSynthesizing
                                    ? t("mediaPlayer.synthesizeFailedTooltip")
                                    : isTranscribing
                                      ? t("mediaPlayer.transcribingTooltip")
                                      : row.transcribeStatus === "failed"
                                        ? t("mediaPlayer.transcribeFailedTooltip")
                                        : row.title
                          }
                        >
                          {isTranscribing && (
                            <span className="inline-flex shrink-0 items-center text-primary">
                              <Spinner className="size-3.5 shrink-0" />
                            </span>
                          )}
                          {row.transcribeStatus === "failed" && !isTranscribing && (
                            <XCircle
                              className="size-3.5 shrink-0 text-destructive"
                              aria-hidden
                            />
                          )}
                          {isTranslating && (
                            <span className="inline-flex shrink-0 items-center text-primary">
                              <Languages className="size-3.5 shrink-0 animate-spin" />
                            </span>
                          )}
                          {row.translateStatus === "failed" && !isTranslating && (
                            <Languages
                              className="size-3.5 shrink-0 text-destructive"
                              aria-hidden
                            />
                          )}
                          {isSynthesizing && (
                            <span className="inline-flex shrink-0 items-center text-primary">
                              <FileVideo className="size-3.5 shrink-0 animate-pulse" />
                            </span>
                          )}
                          {row.synthesizeStatus === "failed" && !isSynthesizing && (
                            <FileVideo className="size-3.5 shrink-0 text-destructive" aria-hidden />
                          )}
                          <span className="truncate">{row.title}</span>
                        </p>
                      </TableCell>

                      {/* Artist */}
                      <TableCell className="w-32 px-2 py-1.5">
                        <p className="truncate text-muted-foreground" title={row.artist}>
                          {row.artist || '-'}
                        </p>
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="w-16 px-2 py-1.5 text-right text-muted-foreground">
                        {isDownloading ? '...' : formatDuration(row.duration)}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {row.jobId && row.status !== 'downloading' && row.status !== 'completed' && (
                      <ContextMenuItem
                        disabled={hasRunningDownload}
                        onClick={() => onDownloadStart?.(row.jobId!)}
                      >
                        <CirclePlay className="size-4 mr-2" />
                        {t('mediaPlayer.trackContextMenu.downloadStart')}
                      </ContextMenuItem>
                    )}
                    {row.jobId && row.status === 'downloading' && (
                      <ContextMenuItem
                        onClick={() => onDownloadStop?.(row.jobId!)}
                      >
                        <CircleStop className="size-4 mr-2" />
                        {t('mediaPlayer.trackContextMenu.downloadStop')}
                      </ContextMenuItem>
                    )}
                    {row.jobId && (
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => onDownloadRemove?.(row.jobId!)}
                      >
                        <CircleX className="size-4 mr-2" />
                        {t('mediaPlayer.trackContextMenu.downloadRemove')}
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      disabled={!row.path || isDownloading}
                      onClick={() => handleOpen(row)}
                    >
                      <FolderOpen className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.open')}
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={isDownloading}
                      onClick={() => handleProperties(row)}
                    >
                      <FileText className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.properties')}
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!row.path || isDownloading}
                      onClick={() => handleEditTags(row)}
                    >
                      <Tag className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.editTags')}
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!row.path || isDownloading}
                      onClick={() => handleFormatConvert(row)}
                    >
                      <FileText className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.formatConvert')}
                    </ContextMenuItem>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger
                        disabled={subtitleSubmenuDisabled}
                        className="flex items-center"
                      >
                        <Captions className="size-4 mr-2" />
                        {t("mediaPlayer.trackContextMenu.subtitle")}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {row.transcribeStatus === "running" && (
                          <ContextMenuItem
                            disabled={!row.path || isDownloading}
                            onClick={() => onTranscribeStop?.(row)}
                          >
                            <CircleStop className="size-4 mr-2" />
                            {t("mediaPlayer.trackContextMenu.transcribeStop")}
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          disabled={transcribeItemDisabled}
                          onClick={() => onTrackTranscribe?.(row)}
                        >
                          <Captions className="size-4 mr-2" />
                          {t("mediaPlayer.trackContextMenu.transcribe")}
                        </ContextMenuItem>
                        {row.translateStatus === "running" && (
                          <ContextMenuItem
                            disabled={!row.path || isDownloading}
                            onClick={() => onTranslateStop?.(row)}
                          >
                            <CircleStop className="size-4 mr-2" />
                            {t("mediaPlayer.trackContextMenu.translateStop")}
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          disabled={translateDisabled}
                          onClick={() => onTrackTranslate?.(row)}
                        >
                          <Languages className="size-4 mr-2" />
                          {t("mediaPlayer.trackContextMenu.translate")}
                        </ContextMenuItem>
                        {row.synthesizeStatus === "running" && (
                          <ContextMenuItem
                            disabled={!row.path || isDownloading}
                            onClick={() => onSynthesizeStop?.(row)}
                          >
                            <CircleStop className="size-4 mr-2" />
                            {t("mediaPlayer.trackContextMenu.synthesizeStop")}
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          disabled={synthesizeDisabled}
                          onClick={() => onTrackSynthesize?.(row)}
                        >
                          <FileVideo className="size-4 mr-2" />
                          {t("mediaPlayer.trackContextMenu.synthesize")}
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuItem
                      variant="destructive"
                      disabled={!row.path || isDownloading}
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.delete')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })
          )}
        </TableBody>
      </Table>
    </section>
  )
}
