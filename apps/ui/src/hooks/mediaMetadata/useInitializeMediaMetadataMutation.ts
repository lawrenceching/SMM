import { useMutation } from "@tanstack/react-query"
import { Path } from "@smm/utils/path"
import { createMediaMetadata } from "@smm/core/mediaMetadata"
import { listMediaFolderFilePaths } from "@/lib/mediaFolderFiles"
import { logger } from "@/lib/log"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

type MediaFolderType = "music-folder" | "tvshow-folder" | "movie-folder"

export function useInitializeMediaMetadataMutation() {
  return useMutation({
    mutationFn: async (vars: {
      folderPathInPlatformFormat: string
      type: MediaFolderType
      traceId?: string
    }): Promise<UIMediaMetadata> => {
      const mm: UIMediaMetadata = {
        status: "idle",
        ...createMediaMetadata(Path.posix(vars.folderPathInPlatformFormat), vars.type),
        files: [],
        mediaFiles: [],
      }

      logger.info({
        traceId: vars.traceId,
        stage: "initialize.listFiles",
        folder: vars.folderPathInPlatformFormat,
        type: vars.type,
      }, "listFiles: scanning folder")

      const start = performance.now()
      const filePaths = await listMediaFolderFilePaths(vars.folderPathInPlatformFormat)
      const durationMs = Math.round(performance.now() - start)

      mm.files = filePaths

      logger.info({
        traceId: vars.traceId,
        stage: "initialize.listFiles",
        folder: vars.folderPathInPlatformFormat,
        fileCount: mm.files.length,
        durationMs,
      }, "listFiles: done")

      return mm
    },
  })
}
