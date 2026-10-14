import Image from "@/components/Image"
import { cn } from "@/lib/utils"
import { toLocalFileImageUrl } from "./toLocalFileImageUrl"

export interface LocalFilePreviewImageProps {
  path: string
  className?: string
  /** Called with the `file://` URL when the user activates the preview. */
  onActivate?: (fileUrl: string) => void
  "aria-label"?: string
}

/**
 * Thumbnail that loads a local file through authenticated image fetch
 * (same path as music / media-table thumbnails).
 */
export function LocalFilePreviewImage({
  path,
  className,
  onActivate,
  "aria-label": ariaLabel,
}: LocalFilePreviewImageProps) {
  const fileUrl = toLocalFileImageUrl(path)
  const canActivate = !!onActivate

  return (
    <button
      type="button"
      onClick={() => onActivate?.(fileUrl)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onActivate?.(fileUrl)
        }
      }}
      className={cn(
        "min-w-0 w-full rounded overflow-hidden bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        canActivate && "cursor-pointer",
      )}
      aria-label={ariaLabel}
      disabled={!canActivate}
    >
      <Image
        url={fileUrl}
        alt=""
        className={cn(
          "w-full h-auto block object-contain pointer-events-none",
          className,
        )}
        data-testid="proxied-preview-image"
      />
    </button>
  )
}
