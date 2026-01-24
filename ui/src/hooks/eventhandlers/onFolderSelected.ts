import { useCallback } from "react"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { listFiles } from "@/api/listFiles"
import { tryToRecognizeMediaFolderByNFO } from "@/components/TvShowPanelUtils"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import type { FolderType } from "@/providers/dialog-provider"
import { getTvShowById } from "@/api/tmdb"
import { useGlobalStates } from "@/providers/global-states-provider"


async function refreshMediaMetadata(mm: MediaMetadata, updateMediaMetadata: (path: string, metadata: MediaMetadata) => void) {
  const tmdbId = mm.tmdbTvShow?.id;
  if (tmdbId === undefined) {
    console.error('[onFolderSelected] Failed to refresh media metadata, tmdbId is undefined')
    return;
  }

  // TODO: set media language
  const response = await getTvShowById(tmdbId, 'zh-CN');
  if (response.error) {
    console.error("[onFolderSelected] Failed to get TV show details:", response.error)
    return
  }

  if (!response.data) {
    console.error("[onFolderSelected] No TV show data returned")
    return
  }


  updateMediaMetadata(mm.mediaFolderPath!, {
    ...mm,
    tmdbTvShow: response.data,
    tmdbMediaType: 'tv',
    type: 'tvshow-folder',
  })

}

export function useOnFolderSelected(addMediaMetadata: (metadata: MediaMetadata) => void, updateMediaMetadata: (path: string, metadata: MediaMetadata) => void) {

  const { setMediaFolderStates } = useGlobalStates()

  const onFolderSelected = useCallback(async (type: FolderType, folderPath: string) => {
    console.log('Folder type selected:', type, 'for path:', folderPath)
    try {
      const response = await readMediaMetadataApi(folderPath)
      const metadata = response.data

      if (!metadata) {
        
        console.log('[AppV2] Failed to read media metadata, it is the first time to open this folder, try to recognize by NFO')
        const initialMetadata: MediaMetadata = {
          mediaFolderPath: Path.posix(folderPath),
          type: type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder",
        }

        setMediaFolderStates((prev) => {
          return {
            ...prev,
            [folderPath]: {
              loading: true
            }
          }
        })

        const resp = await listFiles({
          path: folderPath,
          recursively: true,
          onlyFiles: true,
        })

        if (resp.error) {
          console.error('[AppV2] Failed to list files:', resp.error)
          return;
        }

        if (resp.data === undefined) {
          console.error('[AppV2] Failed to list files:', resp)
          return;
        }

        initialMetadata.files = resp.data.items.map(item => Path.posix(item.path))

        const recognizedMetadata = await tryToRecognizeMediaFolderByNFO(initialMetadata)
        if (recognizedMetadata === undefined) {
          console.error('[AppV2] Failed to recognize media folder by NFO')
          return;
        }
        console.log(`[AppV2] recognizedMetadata:`, recognizedMetadata);
        addMediaMetadata(recognizedMetadata)
        refreshMediaMetadata(recognizedMetadata, updateMediaMetadata)
        return;
      }

      const folderTypeMap: Record<FolderType, "tvshow-folder" | "movie-folder" | "music-folder"> = {
        tvshow: "tvshow-folder",
        movie: "movie-folder",
        music: "music-folder"
      }
      metadata.type = folderTypeMap[type]

      addMediaMetadata(metadata)
    } catch (error) {
      console.error('Failed to read media metadata:', error)
    }
  }, [addMediaMetadata, updateMediaMetadata, setMediaFolderStates])

  return onFolderSelected
}
