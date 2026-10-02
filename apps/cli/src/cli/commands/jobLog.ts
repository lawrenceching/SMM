import { getCore } from '../../core/getCore'
import { persistedJobLogLines, readPersistedJobLog } from '../persistedJobLog'

export async function jobLog(jobId: string): Promise<number> {
  try {
    let messages: string[] | undefined
    try {
      const text = await getCore().getJobLog(jobId)
      messages = persistedJobLogLines(text)
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Job not found') throw error
    }
    if (messages === undefined) {
      const text = await readPersistedJobLog(jobId)
      if (text === null) {
        console.error(`Job not found: ${jobId}`)
        return 1
      }
      messages = persistedJobLogLines(text)
    }
    for (const message of messages) {
      console.log(message)
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
