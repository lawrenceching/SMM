import { getCore } from '../../core/getCore'

export async function jobStop(jobId: string): Promise<number> {
  try {
    getCore().stopJob(jobId)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
