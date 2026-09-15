import type { Core, FolderType, ImportJob } from '@smm/core'

type AddProgressKind = 'tvshow' | 'movie'

function mediaKind(type: FolderType): AddProgressKind | null {
  if (type === 'tvshow') return 'tvshow'
  if (type === 'movie') return 'movie'
  return null
}

const STAGE_ORDER = ['persistFolder', 'recognizeFolder', 'recognizeEpisodes'] as const

type CompletedStage = (typeof STAGE_ORDER)[number]

/**
 * A stage counts as reached once the job reports it (stages are reported on completion)
 * or once the job succeeded. A null stage on an unsettled job means nothing completed yet.
 */
function reached(job: ImportJob, target: CompletedStage): boolean {
  if (job.status === 'succeeded') return true
  if (job.stage === null) return false
  return STAGE_ORDER.indexOf(job.stage as CompletedStage) >= STAGE_ORDER.indexOf(target)
}

export interface AddProgressState {
  imported: boolean
  recognizingMedia: boolean
  recognizedMedia: boolean
  /** True only when recognize stage finished with a title (tvShow/movie found). */
  recognizedOk: boolean
  recognizingEpisodes: boolean
  recognizedEpisodes: boolean
  succeeded: boolean
}

export function createAddProgressState(): AddProgressState {
  return {
    imported: false,
    recognizingMedia: false,
    recognizedMedia: false,
    recognizedOk: false,
    recognizingEpisodes: false,
    recognizedEpisodes: false,
    succeeded: false,
  }
}

/**
 * Print user-facing `smm add` progress lines based on job stage.
 * Pipeline calls onStage after each stage completes.
 */
export function emitAddProgress(
  state: AddProgressState,
  job: ImportJob,
  folder: string,
  type: FolderType,
  log: (line: string) => void = console.log,
): AddProgressState {
  if (job.kind !== "import") return state
  const next = { ...state }
  const kind = mediaKind(type)
  const done = job.status === 'succeeded'

  // Stage 1 persisted smm.json and the blank metadata file.
  if (!next.imported && reached(job, 'persistFolder')) {
    log(`imported folder ${folder}`)
    next.imported = true
  }

  if (kind !== null && next.imported) {
    // Stage 2 starts right after stage 1.
    if (!next.recognizingMedia) {
      log(`recognizing ${kind}`)
      next.recognizingMedia = true
    }

    if (!next.recognizedMedia && reached(job, 'recognizeFolder')) {
      if (job.recognizedTitle) {
        log(`recognized ${kind} "${job.recognizedTitle}"`)
        next.recognizedOk = true
      } else {
        log(`recognition completed and no ${kind} was recognized.`)
      }
      next.recognizedMedia = true
    }

    // Stage 3 only runs meaningfully when a show/movie was actually recognized.
    if (!next.recognizingEpisodes && next.recognizedOk) {
      log('recognizing episodes')
      next.recognizingEpisodes = true
    }

    if (!next.recognizedEpisodes && next.recognizingEpisodes && reached(job, 'recognizeEpisodes')) {
      log('recognized episodes')
      next.recognizedEpisodes = true
    }
  }

  if (!next.succeeded && done) {
    log('succeeded')
    next.succeeded = true
  }

  return next
}

export async function waitUntilImportSettled(
  core: Core,
  id: string,
  options: {
    folder: string
    type: FolderType
    timeoutMs: number
    log?: (line: string) => void
    /** When false, do not print progress lines (used with --skip-init). Default true. */
    progress?: boolean
  },
): Promise<ImportJob> {
  const log = options.log ?? console.log
  const emitProgress = options.progress !== false
  let progress = createAddProgressState()
  const deadline = Date.now() + options.timeoutMs

  for (;;) {
    const job = core.getJob(id)
    if (job?.kind === 'import') {
      if (emitProgress) {
        progress = emitAddProgress(progress, job, options.folder, options.type, log)
      }
      if (job.status !== 'pending' && job.status !== 'running') {
        return job
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for import job ${id}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
