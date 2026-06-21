import type { MediaMetadata } from "@core/types"
import type { FileProps } from "@/lib/types"
import { basename, join } from "@/lib/path"
import { findAssociatedFiles, imageFileExtensions } from "@/lib/utils"

export interface MovieFileModel {
  files: FileProps[]
}

function associatedFileTagToType(
  tag: "SUB" | "AUD" | "NFO" | "POSTER" | "VID",
): FileProps["type"] {
  switch (tag) {
    case "POSTER":
      return "poster"
    case "SUB":
      return "subtitle"
    case "AUD":
      return "audio"
    case "NFO":
      return "nfo"
    case "VID":
      return "video"
    default:
      return "file"
  }
}

/** Movie-folder standard files (movie.nfo, poster.jpg, fanart.jpg) treated as video associations. */
function findMovieFolderAssociatedFiles(allFiles: string[]): Array<{
  path: string
  tag: "NFO" | "POSTER"
}> {
  const result: Array<{ path: string; tag: "NFO" | "POSTER" }> = []
  const added = new Set<string>()

  const tryAdd = (path: string | undefined, tag: "NFO" | "POSTER") => {
    if (!path || added.has(path)) return
    added.add(path)
    result.push({ path, tag })
  }

  tryAdd(allFiles.find((f) => basename(f) === "movie.nfo"), "NFO")

  const poster = allFiles.find((f) => {
    const name = basename(f)
    return (
      name != null &&
      name.startsWith("poster.") &&
      imageFileExtensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()))
    )
  })
  tryAdd(poster, "POSTER")

  const fanart = allFiles.find((f) => {
    const name = basename(f)
    return (
      name != null &&
      name.startsWith("fanart.") &&
      imageFileExtensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()))
    )
  })
  tryAdd(fanart, "POSTER")

  return result
}

export function buildMovieFilesFromMediaMetadata(
  mediaMetadata: MediaMetadata | undefined,
): MovieFileModel | undefined {
  if (!mediaMetadata?.mediaFolderPath) {
    return undefined
  }

  const mediaFolderPath = mediaMetadata.mediaFolderPath
  const files: FileProps[] = []
  const addedPaths = new Set<string>()
  const allFilePaths = mediaMetadata.files ?? []

  for (const file of mediaMetadata.mediaFiles ?? []) {
    const videoPath = file.absolutePath
    files.push({ type: "video", path: videoPath, newPath: undefined })
    addedPaths.add(videoPath)

    const associated = findAssociatedFiles(
      mediaFolderPath,
      allFilePaths,
      videoPath,
    )

    for (const f of associated) {
      const path = join(mediaFolderPath, f.path)
      if (addedPaths.has(path)) continue
      addedPaths.add(path)
      files.push({
        type: associatedFileTagToType(f.tag),
        path,
        newPath: undefined,
      })
    }

    for (const folderFile of findMovieFolderAssociatedFiles(allFilePaths)) {
      if (addedPaths.has(folderFile.path)) continue
      addedPaths.add(folderFile.path)
      files.push({
        type: associatedFileTagToType(folderFile.tag),
        path: folderFile.path,
        newPath: undefined,
      })
    }
  }

  return { files }
}
