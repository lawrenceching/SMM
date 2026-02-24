import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface ImageViewerProps {
  /** When non-null, the viewer is open and displays this image URL. When null, the viewer is closed. */
  imageUrl: string | null
  /** Called when the user closes the viewer (button, Escape, or overlay). */
  onClose: () => void
  /** When true, clicking anywhere in the viewer (image or background) dismisses it. Default: false. */
  dismissOnClick?: boolean
  /** Accessible dialog title (visually hidden). Default: "Image preview". */
  title?: string
  /** Alt text for the image when it has meaning. Omit or use "" for decorative. */
  alt?: string
  /** Optional test id for the dialog container. */
  "data-testid"?: string
}

const fullScreenContentClass =
  "fixed! inset-0! top-0! right-0! bottom-0! left-0! z-100! max-w-none! w-screen! h-screen! translate-x-0! translate-y-0! rounded-none border-0 bg-black/95 flex items-center justify-center p-4 gap-0 " +
  "**:data-[slot=dialog-close]:relative **:data-[slot=dialog-close]:z-10 " +
  "**:data-[slot=dialog-close]:text-white **:data-[slot=dialog-close]:opacity-90 **:data-[slot=dialog-close]:hover:opacity-100 **:data-[slot=dialog-close]:hover:bg-white/15"

export function ImageViewer({
  imageUrl,
  onClose,
  dismissOnClick = false,
  title = "Image preview",
  alt = "",
  "data-testid": dataTestId = "image-viewer",
}: ImageViewerProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")

  // Reset status when imageUrl changes so we show loading again for the new image
  useEffect(() => {
    if (imageUrl) {
      setStatus("loading")
    }
  }, [imageUrl])

  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={true}
        className={fullScreenContentClass}
        aria-describedby={undefined}
        data-testid={dataTestId}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/* Clickable backdrop: absolute inset-0 so it fills the dialog and reliably receives clicks */}
        <div
          className={cn(
            "absolute inset-0 z-0 flex items-center justify-center",
            dismissOnClick && "cursor-pointer"
          )}
          data-testid={dismissOnClick ? `${dataTestId}-backdrop` : undefined}
          onClick={dismissOnClick ? onClose : undefined}
          onKeyDown={
            dismissOnClick
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onClose()
                  }
                }
              : undefined
          }
          role={dismissOnClick ? "button" : undefined}
          tabIndex={dismissOnClick ? 0 : undefined}
          aria-label={dismissOnClick ? "Click to close" : undefined}
        >
          {imageUrl && (
            <>
              {status === "loading" && (
                <Loader2
                  className="absolute size-10 text-white/70 animate-spin"
                  aria-hidden
                />
              )}
              {status === "error" && (
                <p className="text-white/90 text-sm text-center px-4">
                  Image failed to load
                </p>
              )}
              <img
                src={imageUrl}
                alt={alt}
                className={cn(
                  "max-w-full max-h-full object-contain pointer-events-none",
                  status === "loaded"
                    ? "opacity-100"
                    : "opacity-0 absolute",
                  status === "error" && "hidden"
                )}
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("error")}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
