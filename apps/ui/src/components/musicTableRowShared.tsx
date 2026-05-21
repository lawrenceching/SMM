import { isAbsPath, join } from "@/lib/path"
import { Path } from "@core/path"
import { pathToFileURL } from "@core/url"
import { TableCell } from "@/components/ui/table"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Music } from "lucide-react"
import Image from "@/components/Image"

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/** Builds a file:// URL for the thumbnail that the backend can resolve. */
export function getThumbnailImageUrl(
  thumbnailPath: string,
  mediaFolderPath: string | undefined,
): string {
  if (
    thumbnailPath.startsWith("http://") ||
    thumbnailPath.startsWith("https://") ||
    thumbnailPath.startsWith("file://")
  ) {
    return thumbnailPath
  }

  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  return pathToFileURL(platformPath)
}

export function ThumbnailPreview({
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

export interface MusicRowMediaCellsProps {
  title: string
  artist: string
  duration: number
  thumbnail?: string
  mediaFolderPath?: string
  isSelected?: boolean
  titleTooltip?: string
  durationLabel?: string
}

export function MusicRowMediaCells({
  title,
  artist,
  duration,
  thumbnail,
  mediaFolderPath,
  isSelected = false,
  titleTooltip,
  durationLabel,
}: MusicRowMediaCellsProps) {
  return (
    <>
      <TableCell className="w-16 px-0 py-1.5">
        {thumbnail ? (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="mx-auto h-8 w-14 cursor-default overflow-hidden rounded">
                <Image
                  url={getThumbnailImageUrl(thumbnail, mediaFolderPath)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              side="right"
              align="center"
              className="w-auto max-w-[240px] p-1"
            >
              <ThumbnailPreview
                thumbnailPath={thumbnail}
                mediaFolderPath={mediaFolderPath}
              />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <div className="mx-auto flex h-8 w-14 items-center justify-center rounded bg-muted">
            <Music className="size-3 text-muted-foreground/50" />
          </div>
        )}
      </TableCell>

      <TableCell className="min-w-0 px-2 py-1.5">
        <p
          className={`min-w-0 truncate ${isSelected ? "font-medium text-primary" : ""}`}
          title={titleTooltip ?? title}
        >
          <span className="truncate">{title}</span>
        </p>
      </TableCell>

      <TableCell className="w-32 px-2 py-1.5">
        <p className="truncate text-muted-foreground" title={artist}>
          {artist || "-"}
        </p>
      </TableCell>

      <TableCell className="w-16 px-2 py-1.5 text-right text-muted-foreground">
        {durationLabel ?? formatDuration(duration)}
      </TableCell>
    </>
  )
}
