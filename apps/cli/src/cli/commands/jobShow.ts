import { ScrapeJob } from '@smm/core'
import { getCore } from '../../core/getCore'
import { formatScrapeJobTaskLines } from '../scrapeJobFormat'
import { printJson } from './shared'

export async function jobShow(jobId: string): Promise<number> {
  try {
    const job = getCore().getJob(jobId)
    if (job === undefined) {
      console.error(`Job not found: ${jobId}`)
      return 1
    }
    if (job instanceof ScrapeJob) {
      for (const line of formatScrapeJobTaskLines(job)) {
        console.log(line)
      }
      return 0
    }
    if (job.type === 'import-library') {
      printJson(job)
      return 0
    }
    printJson(job)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
