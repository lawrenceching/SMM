import type { MediaMetadata } from "@smm/types";
import pino from 'pino'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function minimize(mm: MediaMetadata): any {
    return {
        mediaFolderPath: mm.mediaFolderPath,
        type: mm.type,
        name: mm.tvShow?.name,
        mediaFileCount: mm.mediaFiles?.length ?? 0,
        tvShow: {
            id: mm.tvShow?.id,
            name: mm.tvShow?.name,
        },
        movie: {
            id: mm.movie?.id,
            name: mm.movie?.name,
        },
    }
}



const logger = pino({
  browser: {
    asObject: true,
    serialize: true,
  },
  timestamp: () => {
    return new Date().toLocaleTimeString()
  }
})

export { logger }