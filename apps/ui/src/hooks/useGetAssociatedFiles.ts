import { useMemo } from "react"
import { useQuery, skipToken } from "@tanstack/react-query"
import { mediaFolderFilesReadQueryOptions } from "@/lib/mediaFolderFiles"
import { basename, extname } from "@/lib/path"
import { extensions } from "@smm/types/mediaFileExtensions"
import type { AssociatedFile } from "@/types/associated-files"

function filterAssociatedFiles(allFilePaths: string[], videoFilePath: string): AssociatedFile[] {
  const filename = basename(videoFilePath) ?? ""
  const ext = extname(filename)
  const stem = filename.replace(ext, "")

  const findFiles = (
    exts: string[],
    type: AssociatedFile["type"],
    results: AssociatedFile[],
  ) => {
    const possibleNames = exts.map((e) => stem + e)
    for (const fp of allFilePaths) {
      const base = basename(fp) ?? ""
      if (possibleNames.includes(base)) {
        results.push({ type, path: fp })
        continue
      }
      if (base.startsWith(stem + ".")) {
        if (exts.some((e) => base.endsWith(e))) {
          results.push({ type, path: fp })
        }
      }
    }
  }

  const results: AssociatedFile[] = []
  findFiles(extensions.subtitleFileExtensions, "subtitle", results)
  findFiles(extensions.imageFileExtensions, "thumbnail", results)
  findFiles(extensions.audioTrackFileExtensions, "audio", results)

  // Summary files: match {stem}_summary*.txt (e.g. song_summary.txt, song_summary_1.txt)
  for (const fp of allFilePaths) {
    const base = basename(fp) ?? ""
    if (base.startsWith(stem + "_summary") && base.endsWith(".txt")) {
      results.push({ type: "summary", path: fp })
    }
  }

  return results
}

export function useGetAssociatedFiles(
  mediaFolderPath: string | undefined,
  fileAbsPath: string | undefined,
) {
  const trimmed = mediaFolderPath?.trim() ?? ""
  const readOpts = trimmed ? mediaFolderFilesReadQueryOptions(trimmed) : null

  const { data: allPaths = [] } = useQuery<string[]>({
    queryKey: readOpts?.queryKey ?? (["associatedFiles", null] as const),
    queryFn: readOpts?.queryFn ?? skipToken,
    enabled: Boolean(trimmed) && Boolean(fileAbsPath),
    staleTime: 30_000,
  })

  return useMemo<AssociatedFile[]>(() => {
    if (!trimmed || !fileAbsPath) return []
    return filterAssociatedFiles(allPaths, fileAbsPath)
  }, [allPaths, fileAbsPath, trimmed])
}
