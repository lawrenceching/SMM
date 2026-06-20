import { listFiles } from "@/api/listFiles"
import { basename, dirname, extname } from "@/lib/path"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import { imageFileExtensions } from "@/lib/utils"
import type { ScrapeTaskId } from "./types"

export async function checkTaskCompletion(
  mediaMetadata: MediaMetadata,
): Promise<Record<ScrapeTaskId, boolean>> {
  const defaultCompletion: Record<ScrapeTaskId, boolean> = {
    poster: false,
    fanart: false,
    thumbnails: false,
    nfo: false,
  }

  if (!mediaMetadata.mediaFolderPath) {
    return defaultCompletion
  }

  try {
    const response = await listFiles({
      path: Path.toPlatformPath(mediaMetadata.mediaFolderPath),
      onlyFiles: true,
      recursively: true,
    })

    if (!response.data?.items) {
      return defaultCompletion
    }

    const files = response.data.items.map((p) => Path.posix(p.path))
    const hasImageNamed = (prefix: "poster" | "fanart") =>
      files.some((file) => {
        const fileName = basename(file)
        if (!fileName) return false
        return (
          fileName.startsWith(`${prefix}.`) &&
          imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
        )
      })

    const poster = hasImageNamed("poster")
    const fanart = hasImageNamed("fanart")

    let nfo = false
    if (mediaMetadata.type === "movie-folder") {
      nfo = files.some((file) => basename(file) === "movie.nfo")
    } else {
      const tvshowNfoOk = files.some((file) => basename(file) === "tvshow.nfo")
      let episodeNfosOk = true
      for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
        if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue
        const videoBase = basename(mediaFile.absolutePath)
        if (!videoBase) continue
        const videoExt = extname(videoBase)
        const noExt = videoExt ? videoBase.slice(0, -videoExt.length) : videoBase
        const expectedNfo = `${noExt}.nfo`
        const videoDir = dirname(mediaFile.absolutePath)
        const found = files.some((file) => dirname(file) === videoDir && basename(file) === expectedNfo)
        if (!found) {
          episodeNfosOk = false
          break
        }
      }
      nfo = tvshowNfoOk && episodeNfosOk
    }

    let thumbnails = true
    let recognizedEpisodeCount = 0
    for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
      if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue
      recognizedEpisodeCount += 1
      const videoBase = basename(mediaFile.absolutePath)
      if (!videoBase) {
        thumbnails = false
        break
      }
      const videoExt = extname(videoBase)
      const noExt = videoBase.replace(videoExt, "")
      const videoDir = dirname(mediaFile.absolutePath)
      const filesInSameDir = files.filter((file) => dirname(file) === videoDir)
      const hasThumb = filesInSameDir.some((file) => {
        const fileName = basename(file)
        if (!fileName) return false
        return (
          fileName.startsWith(`${noExt}.`) &&
          imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
        )
      })
      if (!hasThumb) {
        thumbnails = false
        break
      }
    }

    if (recognizedEpisodeCount === 0) {
      thumbnails = false
    }

    return { poster, fanart, thumbnails, nfo }
  } catch {
    return defaultCompletion
  }
}
