import { z } from 'zod'

export const SCRAPE = 'scrape' as const

export const SCRAPE_DESCRIPTION =
  'Start a scrape job for a managed TV show or movie folder (poster, fanart, thumbnails, nfo). ' +
  'Returns a job id immediately; the scrape runs in the background. ' +
  'Call get-job with the returned id to check progress and per-task status. ' +
  'Supports TMDB and TVDB. Movie folders skip thumbnails.\n\n' +
  'Example: Scrape media folder "/path/to/Show".'

/** Fixed success message returned with a new scrape job id. */
export const SCRAPE_JOB_CREATED_MESSAGE =
  'scrape job created, use get-job tool to check job status by id.'

export const scrapeInputSchema = z.object({
  path: z
    .string()
    .describe(
      'Absolute path of the managed media folder to scrape (POSIX or Windows format)',
    ),
  language: z
    .string()
    .optional()
    .describe(
      'Optional language code for metadata/assets (defaults to user preferMediaLanguage)',
    ),
})

export const scrapeOutputSchema = z.object({
  id: z.string().describe('Scrape job id; pass to get-job to poll status'),
  message: z
    .string()
    .describe('Guidance for checking job status with get-job'),
  error: z
    .string()
    .optional()
    .describe('Error message when the scrape job could not be started'),
})

export type ScrapeInput = z.infer<typeof scrapeInputSchema>
export type ScrapeOutput = z.infer<typeof scrapeOutputSchema>
