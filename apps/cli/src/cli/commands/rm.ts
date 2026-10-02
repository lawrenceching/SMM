import { getCore } from '../../core/getCore'
import { isFolderImported } from '../folderDisplay'

export async function rm(folder: string): Promise<number> {
  try {
    if (!(await isFolderImported(folder))) {
      console.error(`Folder is not imported: ${folder}`)
      return 1
    }
    await getCore().unimportFolder(folder)
    console.log(`Removed ${folder}`)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
