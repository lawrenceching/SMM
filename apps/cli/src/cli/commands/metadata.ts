import { readFile } from 'node:fs/promises'
import type { MediaMetadata } from '@smm/types'
import { getCore } from '@smm/server'
import { formatMediaMetadata, isFolderImported } from '@smm/server'

export async function metadata(
  folder: string,
  options: { set?: string },
): Promise<number> {
  try {
    if (!(await isFolderImported(folder))) {
      console.error(`Folder is not imported: ${folder}`)
      return 1
    }
    if (options.set !== undefined) {
      const raw = await readFile(options.set, 'utf-8')
      const mm = JSON.parse(raw) as MediaMetadata
      await getCore().setMetadata(folder, {
        type: mm.type,
        mediaFiles: mm.mediaFiles,
        tvShow: mm.tvShow,
        movie: mm.movie,
      })
      console.log(`updated metadata for ${folder}`)
      return 0
    }
    const mm = await getCore().getMetadata(folder)
    for (const line of formatMediaMetadata(folder, mm)) {
      console.log(line)
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
