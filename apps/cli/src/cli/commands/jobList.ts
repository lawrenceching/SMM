import { getLogDir } from '../../utils/config'
import { listPersistedImportJobIds } from '../persistedJobLog'

export async function jobList(): Promise<number> {
  try {
    const ids = await listPersistedImportJobIds(getLogDir())
    for (const id of ids) {
      console.log(id)
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
