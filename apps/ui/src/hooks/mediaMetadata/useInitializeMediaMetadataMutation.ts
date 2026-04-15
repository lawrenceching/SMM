import { useMutation } from "@tanstack/react-query"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import { listFiles } from "@/api/listFiles"
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

      const files = await listFiles({ path: vars.folderPathInPlatformFormat, recursively: true, onlyFiles: true })
      if(files.error) {
        throw new Error(`Failed to list files: ${files.error}`)
      }
      if(files.data === undefined) {
        throw new Error(`Failed to list files: response.data is undefined`)
      }
      mm.files = files.data.items.map(item => Path.posix(item.path))

      return mm;
    },
  })
}

