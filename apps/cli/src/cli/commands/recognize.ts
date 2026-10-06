import { getCore } from '@smm/server'
import { confirmRecognizeCandidate } from '../recognizeConfirm'

export async function recognize(
  folder: string,
  options: { db?: string; id?: string; yes?: boolean },
): Promise<number> {
  try {
    const hasDb = options.db !== undefined
    const hasId = options.id !== undefined
    if (hasDb !== hasId) {
      console.error('--db and --id must be provided together')
      return 1
    }
    const core = getCore()
    if (hasDb && hasId) {
      await core.recognizeFolder(folder, {
        db: options.db as 'tmdb' | 'tvdb',
        id: options.id!,
      })
      console.log('Metadata is updated')
      return 0
    }
    const candidate = await core.tryToRecognizeFolder(folder)
    const accepted = await confirmRecognizeCandidate(candidate, { yes: Boolean(options.yes) })
    if (!accepted) {
      console.log('Cancelled')
      return 0
    }
    await core.recognizeFolder(folder, { db: candidate.db, id: candidate.id })
    console.log('Metadata is updated')
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
