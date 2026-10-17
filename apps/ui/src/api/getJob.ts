import { rpc, unwrapJson } from '@/lib/rpc'

export type { ImportLibraryJobTask } from '@smm/types/job/ImportLibraryJob'

type GetJobResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['get-job']['$post']>>['json']>
>

type SerializedJob = Exclude<GetJobResponseBody, { error: string }>['data']

type ImportJob = Extract<SerializedJob, { kind: 'import' }>
export type ScrapeJob = Extract<SerializedJob, { kind: 'scrape' }>
export type ImportLibraryJob = Extract<SerializedJob, { type: 'import-library' }>
type YtdlpJob = Extract<SerializedJob, { kind: 'ytdlp' }>
type TranscribeSubtitleJob = Extract<SerializedJob, { kind: 'transcribe-subtitle' }>
type TranslateSubtitleJob = Extract<SerializedJob, { kind: 'translate-subtitle' }>
type SynthesizeSubtitleJob = Extract<SerializedJob, { kind: 'synthesize-subtitle' }>
type ProcessSubtitleJob = Extract<SerializedJob, { kind: 'process-subtitle' }>
export type Job =
  | ImportJob
  | ImportLibraryJob
  | ScrapeJob
  | YtdlpJob
  | TranscribeSubtitleJob
  | TranslateSubtitleJob
  | SynthesizeSubtitleJob
  | ProcessSubtitleJob
export type JobStatus = ImportJob['status']
export type ScrapeTaskRuntimeStatus = ScrapeJob['tasks'][keyof ScrapeJob['tasks']]['status']

/** Poll Core job (`POST /api/get-job`). */
export async function getJob(id: string, signal?: AbortSignal): Promise<GetJobResponseBody> {
  const resp = await rpc.api['get-job'].$post({ json: { id } }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns job. */
export async function getJobViaCore(id: string, signal?: AbortSignal): Promise<Job> {
  const body = await getJob(id, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data as Job
}
