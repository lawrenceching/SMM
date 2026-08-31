import type { MediaMetadataWithFolderFiles } from "@/lib/mediaFolderFiles";
import { isNil } from "es-toolkit";
import pino from 'pino'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function minimize(mm: MediaMetadataWithFolderFiles): any {
    return {
        mediaFolderPath: mm.mediaFolderPath,
        type: mm.type,
        name: mm.tvShow?.name,
        files: `${isNil(mm.files) ? mm.files : `${mm.files?.length ?? 0} files`}`,
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