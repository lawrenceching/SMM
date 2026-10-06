import { getCore } from '@smm/server'
import { resolvePathUnderMediaFolder } from '../resolvePathUnderMediaFolder'
import { printEpisodeRenameResult } from '../renameDispatch'

export async function renameEpisodeFile(
  folder: string,
  options: { from: string; to: string },
): Promise<number> {
  try {
    const from = resolvePathUnderMediaFolder(folder, options.from)
    const to = resolvePathUnderMediaFolder(folder, options.to)
    const result = await getCore().renameEpisodeFile({
      mediaFolderPath: folder,
      from,
      to,
    })
    return printEpisodeRenameResult(result) ? 1 : 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
