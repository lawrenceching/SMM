import { useCallback, useRef, useState } from "react"
import { listYtdlpFormats, type YtdlpListFormatsRequest } from "@/api/ytdlp"
import { type YtdlpListFormatsResult } from "@/lib/parseYtdlpListFormats"

export interface UseListFormatsMutationReturn {
  /** Parsed format listing result, or null if not yet fetched. */
  formatsResult: YtdlpListFormatsResult | null
  /** True while `--list-formats` is executing. */
  isListing: boolean
  /** Error message from the last listing attempt, or null. */
  listingError: string | null
  /** Call to trigger format listing. */
  listFormats: (req: YtdlpListFormatsRequest, onSettled?: () => void) => void
  /** Reset mutation state. */
  reset: () => void
}

export function useListFormatsMutation(): UseListFormatsMutationReturn {
  const [formatsResult, setFormatsResult] = useState<YtdlpListFormatsResult | null>(null)
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
        setFormatsResult(result)
        setIsListing(false)
      })
      .catch((err) => {
        if (gen !== genRef.current) return
        const message = err instanceof Error ? err.message : String(err)
        setListingError(message)
        setFormatsResult(null)
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
    setFormatsResult(null)
    setIsListing(false)
    setListingError(null)
  }, [])

  return { formatsResult, isListing, listingError, listFormats, reset }
}
