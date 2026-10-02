import { getCore } from '../../core/getCore'
import { Path } from '@smm/utils/path'
import { classifyRenameTarget, printEpisodeRenameResult } from '../renameDispatch'

export async function rename(from: string, to: string): Promise<number> {
  try {
    const core = getCore()
    const folders = await core.getFolders()
    const classified = await classifyRenameTarget(from, folders)
    if (classified.kind === 'folder') {
      await core.renameFolder({ from, to })
      console.log(`${Path.posix(from)} → ${Path.posix(to)}`)
      return 0
    }
    const result = await core.renameEpisodeFile({
      mediaFolderPath: classified.mediaFolderPath,
      from,
      to,
    })
    return printEpisodeRenameResult(result) ? 1 : 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
