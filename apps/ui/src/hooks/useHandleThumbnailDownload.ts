import type { MediaMetadata } from "@core/types"
import { useScrapeThumbnailMutation } from "./useScrapeThumbnailMutation"

export function useHandleThumbnailDownload() {
  const { mutateAsync } = useScrapeThumbnailMutation()
  return async (mediaMetadata: MediaMetadata) => {
    await mutateAsync({ mediaMetadata })
  }
}
