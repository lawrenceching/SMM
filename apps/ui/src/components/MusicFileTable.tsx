import { relative, isAbsPath, join } from "@/lib/path"
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
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Play, FolderOpen, Trash2, FileText, Music } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import Image from "@/components/Image"
import { useTranslation } from "@/lib/i18n"
import { emitTrackOpenEvent, emitTrackDeleteEvent, emitTrackPropertiesEvent, emitTrackFormatConvertEvent } from "@/lib/musicEvents"

export interface MusicFileRow {
  id: number
  index: number
  title: string
  artist: string
  duration: number
  thumbnail?: string
  path?: string
  status?: "pending" | "downloading" | "completed" | "failed"
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
}: MusicFileTableProps) {
  const { t } = useTranslation(['components'])

  console.log("[MusicFileTable] render", { dataLength: data.length })

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

  const handleProperties = (track: MusicFileRow) => {
    emitTrackPropertiesEvent({
      id: track.id,
      title: track.title,
    })
  }

  const handleFormatConvert = (track: MusicFileRow) => {
    emitTrackFormatConvertEvent({
      id: track.id,
    })
  }

  return (
    <section className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-10 px-2 py-1 text-center">#</TableHead>
            <TableHead className="h-8 w-16 px-0 py-1 text-center">Cover</TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">Title</TableHead>
            <TableHead className="h-8 w-32 px-2 py-1">Artist</TableHead>
            <TableHead className="h-8 w-16 px-2 py-1 text-right">Duration</TableHead>
            <TableHead className="h-8 w-8 px-2 py-1"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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

              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild disabled={isDownloading}>
                    <TableRow
                      className={`cursor-pointer group ${isActive ? 'bg-muted' : ''}`}
                      onClick={() => !isDownloading && onTrackClick?.(row.id)}
                    >
                      {/* Index / Play indicator */}
                      <TableCell className="w-10 px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center">
                          {isDownloading ? (
                            <Spinner className="size-4 text-blue-500" />
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
                          {!isActive && (
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
                        <p className={`truncate ${isActive ? 'text-green-500 font-medium' : ''}`} title={row.title}>
                          {row.title}
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

                      {/* Status */}
                      <TableCell className="w-8 px-2 py-1.5">
                        {row.status === 'downloading' && (
                          <div className="flex items-center justify-center">
                            <Spinner className="size-4 text-blue-500" />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
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
                      onClick={() => handleFormatConvert(row)}
                    >
                      <FileText className="size-4 mr-2" />
                      {t('mediaPlayer.trackContextMenu.formatConvert')}
                    </ContextMenuItem>
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
