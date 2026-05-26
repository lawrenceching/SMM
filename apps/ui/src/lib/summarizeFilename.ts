import { dirname, basename, extname, join } from "@/lib/path"
import { writeFile } from "@/api/writeFile"
import { ExistedFileError } from "@core/errors"

/**
 * Finds an available summary file path for the given video file.
 * Tries `{stem}_summary.txt`, then `{stem}_summary_1.txt`, `{stem}_summary_2.txt`, etc.
 * Uses writeFile with 'create' mode so the check + write is atomic.
 *
 * @param videoPath - Absolute platform path to the video file
 * @param summaryContent - The summary text to write
 * @returns The path that was successfully written
 * @throws If all attempts fail (up to 999) or path cannot be resolved
 */
export async function findAndWriteSummaryFile(
  videoPath: string,
  summaryContent: string,
): Promise<string> {
  const dir = dirname(videoPath) ?? ""
  const base = basename(videoPath) ?? ""
  const ext = extname(base) ?? ""
  const stem = base.slice(0, -ext.length)

  if (!stem) {
    throw new Error(`Could not determine filename stem from path: ${videoPath}`)
  }

  // Try base name first, then numbered suffixes
  const candidates: string[] = [join(dir, `${stem}_summary.txt`)]
  for (let i = 1; i < 1000; i++) {
    candidates.push(join(dir, `${stem}_summary_${i}.txt`))
  }

  for (const candidate of candidates) {
    try {
      await writeFile(candidate, summaryContent, 'create')
      return candidate
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(ExistedFileError)) {
        continue // try next candidate
      }
      throw error // rethrow other errors
    }
  }

  throw new Error("Could not find an available summary filename after 1000 attempts")
}
