import { Path } from '../path'
import {
  SCRAPE_JOB_CREATED_MESSAGE,
  type ScrapeOutput,
} from '../types/ai-tools/scrape'

export function scrapeSucceeded(id: string): ScrapeOutput {
  return {
    id,
    message: SCRAPE_JOB_CREATED_MESSAGE,
  }
}

export function scrapeFailed(path: string, error: string): ScrapeOutput {
  return {
    id: '',
    message: '',
    error: path.trim()
      ? `${error} (path: ${Path.toPlatformPath(path)})`
      : error,
  }
}
