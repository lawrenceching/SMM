import { z } from 'zod'

export const GET_JOB = 'get-job' as const

export const GET_JOB_DESCRIPTION =
  'Get the status of a background job by id. ' +
  'Supports scrape jobs (kind: "scrape" with poster/fanart/thumbnails/nfo tasks) ' +
  'and import jobs (kind: "import"). ' +
  'Poll until status is succeeded, failed, or aborted.\n\n' +
  'Example: Check job status for id "550e8400-e29b-41d4-a716-446655440000".'

const jobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'aborted',
])

const scrapeTaskRuntimeStatusSchema = z.enum([
  'pending',
  'running',
  'skipped',
  'completed',
  'failed',
])

const scrapeJobTaskSchema = z.object({
  status: scrapeTaskRuntimeStatusSchema,
  error: z.string().optional(),
})

export const scrapeJobSchema = z.object({
  kind: z.literal('scrape'),
  id: z.string(),
  folderPath: z.string(),
  status: jobStatusSchema,
  tasks: z.object({
    poster: scrapeJobTaskSchema,
    fanart: scrapeJobTaskSchema,
    thumbnails: scrapeJobTaskSchema,
    nfo: scrapeJobTaskSchema,
  }),
  error: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const importJobSchema = z.object({
  kind: z.literal('import'),
  id: z.string(),
  folderPath: z.string(),
  type: z.string(),
  status: jobStatusSchema,
  stage: z.string().nullable(),
  progress: z.number(),
  recognizedTitle: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const jobSchema = z.discriminatedUnion('kind', [
  scrapeJobSchema,
  importJobSchema,
])

export const getJobInputSchema = z.object({
  id: z.string().describe('Job id returned by scrape or import-folder'),
})

export const getJobOutputSchema = z.object({
  job: jobSchema.optional().describe('Job payload when found'),
  error: z
    .string()
    .optional()
    .describe('Error message when the job could not be loaded'),
})

export type GetJobInput = z.infer<typeof getJobInputSchema>
export type GetJobOutput = z.infer<typeof getJobOutputSchema>
export type JobToolPayload = z.infer<typeof jobSchema>
