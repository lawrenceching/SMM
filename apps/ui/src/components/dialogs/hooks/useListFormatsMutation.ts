import { useCallback, useRef, useState } from "react"
import { listYtdlpFormats, type YtdlpListFormatsRequest } from "@/api/ytdlp"
import type { VideoMetadata } from "@/api/ytdlp/types"
import {
  classifyYtdlpError,
  getYtdlpErrorMessage,
} from "@/lib/ytdlpErrorDetection"
import { useTranslation } from "@/lib/i18n"

export interface UseListFormatsMutationReturn {
  /** Parsed video metadata from `yt-dlp -J`, or null if not yet fetched. */
  videoMetadata: VideoMetadata | null
  /** When `yt-dlp -J` returns a playlist, the video list entries extracted from it; null otherwise. */
  videoListEntries: VideoMetadata[] | null
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
  const { t } = useTranslation("dialogs")
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [videoListEntries, setVideoListEntries] = useState<VideoMetadata[] | null>(null)
  const [isListing, setIsListing] = useState(false)
  const [listingError, setListingError] = useState<string | null>(null)
  const genRef = useRef(0)

  const listFormats = useCallback((req: YtdlpListFormatsRequest, onSettled?: () => void) => {
    const gen = ++genRef.current
    setIsListing(true)
    setListingError(null)
    setVideoListEntries(null)

    listYtdlpFormats(req)
      .then((result) => {
        if (gen !== genRef.current) return
        setVideoMetadata(result.videoMetadata)
        setVideoListEntries(result.playlistEntries ?? null)
        setIsListing(false)
      })
      .catch((err) => {
        if (gen !== genRef.current) return
        const errMessage = err instanceof Error ? err.message : String(err)
        // Classify the error using the combined error text
        const result = classifyYtdlpError({
          stderr: errMessage,
          stdout: "",
          exitCode: null,
        })
        const displayMessage = getYtdlpErrorMessage(result, t as any)
        setListingError(displayMessage)
        setVideoMetadata(null)
        setVideoListEntries(null)
        setIsListing(false)
      })
      .finally(() => {
        if (gen === genRef.current) {
          onSettled?.()
        }
      })
  }, [t])

  const reset = useCallback(() => {
    genRef.current += 1
    setVideoMetadata(null)
    setVideoListEntries(null)
    setIsListing(false)
    setListingError(null)
  }, [])

  return { videoMetadata, videoListEntries, isListing, listingError, listFormats, reset }
}
