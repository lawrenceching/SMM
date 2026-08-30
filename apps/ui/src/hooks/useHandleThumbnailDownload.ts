import type { MediaMetadata } from "@smm/types"
import { useScrapeThumbnailMutation } from "./useScrapeThumbnailMutation"

export function useHandleThumbnailDownload() {
  const { mutateAsync } = useScrapeThumbnailMutation()
  return async (mediaMetadata: MediaMetadata) => {
    await mutateAsync({ mediaMetadata })
  }
}
