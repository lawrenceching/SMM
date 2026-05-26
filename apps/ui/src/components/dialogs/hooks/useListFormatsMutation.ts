import { useCallback, useRef, useState } from "react"
import { listYtdlpFormats, type YtdlpListFormatsRequest } from "@/api/ytdlp"
import type { VideoMetadata } from "@/api/ytdlp/types"
import { reportYtdlpError } from "@/lib/ytdlpErrorDetection"

export interface UseListFormatsMutationReturn {
  /** Parsed video metadata from `yt-dlp -J`, or null if not yet fetched. */
  videoMetadata: VideoMetadata | null
  /** True while `yt-dlp -J` is executing. */
  isListing: boolean
  /** Error message from the last listing attempt, or null. */
  listingError: string | null
  /** Call to trigger format listing. */
  listFormats: (req: YtdlpListFormatsRequest, onSettled?: () => void) => void
  /** Reset mutation state. */
  reset: () => void
}

export function useListFormatsMutation(): UseListFormatsMutationReturn {
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [isListing, setIsListing] = useState(false)
  const [listingError, setListingError] = useState<string | null>(null)
  const genRef = useRef(0)

  const listFormats = useCallback((req: YtdlpListFormatsRequest, onSettled?: () => void) => {
    const gen = ++genRef.current
    setIsListing(true)
    setListingError(null)

    listYtdlpFormats(req)
      .then((result) => {
        if (gen !== genRef.current) return
        setVideoMetadata(result)
        setIsListing(false)
      })
      .catch((err) => {
        if (gen !== genRef.current) return
        const message = err instanceof Error ? err.message : String(err)
        reportYtdlpError("list-formats", message, err)
        setListingError(message)
        setVideoMetadata(null)
        setIsListing(false)
      })
      .finally(() => {
        if (gen === genRef.current) {
          onSettled?.()
        }
      })
  }, [])

  const reset = useCallback(() => {
    genRef.current += 1
    setVideoMetadata(null)
    setIsListing(false)
    setListingError(null)
  }, [])

  return { videoMetadata, isListing, listingError, listFormats, reset }
}
