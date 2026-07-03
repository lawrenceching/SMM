import { useMutation } from "@tanstack/react-query"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import { listFiles } from "@/api/listFiles"
import { logger } from "@/lib/log"
type MediaFolderType = "music-folder" | "tvshow-folder" | "movie-folder"

export function useInitializeMediaMetadataMutation() {

  return useMutation({
    mutationFn: async (vars: {
      folderPathInPlatformFormat: string
      type: MediaFolderType
      traceId?: string
    }): Promise<MediaMetadata> => {

      const mm: MediaMetadata = {
        mediaFolderPath: Path.posix(vars.folderPathInPlatformFormat),
        type: vars.type,
        files: [],
        mediaFiles: [],
      }

      logger.info({
        traceId: vars.traceId,
        stage: 'initialize.listFiles',
        folder: vars.folderPathInPlatformFormat,
        type: vars.type,
      }, 'listFiles: scanning folder')

      const start = performance.now()
      const files = await listFiles({ path: vars.folderPathInPlatformFormat, recursively: true, onlyFiles: true })
      const durationMs = Math.round(performance.now() - start)

      if(files.error) {
        logger.error({
          traceId: vars.traceId,
          stage: 'initialize.listFiles',
          folder: vars.folderPathInPlatformFormat,
          durationMs,
          error: files.error,
        }, 'listFiles: failed')
        throw new Error(`Failed to list files: ${files.error}`)
      }
      if(files.data === undefined) {
        logger.error({
          traceId: vars.traceId,
          stage: 'initialize.listFiles',
          folder: vars.folderPathInPlatformFormat,
          durationMs,
        }, 'listFiles: response.data is undefined')
        throw new Error(`Failed to list files: response.data is undefined`)
      }
      mm.files = files.data.items.map(item => Path.posix(item.path))

      logger.info({
        traceId: vars.traceId,
        stage: 'initialize.listFiles',
        folder: vars.folderPathInPlatformFormat,
        fileCount: mm.files.length,
        durationMs,
      }, 'listFiles: done')

      return mm;
    },
  })
}

