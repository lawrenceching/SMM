import type { Core, FolderType, ImportJob, JobStage } from 'core-app'

export type AddProgressKind = 'tvshow' | 'movie'

function mediaKind(type: FolderType): AddProgressKind | null {
  if (type === 'tvshow') return 'tvshow'
  if (type === 'movie') return 'movie'
  return null
}

/** Stages at or after listFiles (recognition about to start or already running). */
function stageAtOrAfterListFiles(stage: JobStage): boolean {
  return (
    stage === 'listFiles' ||
    stage === 'recognize' ||
    stage === 'episodes' ||
    stage === 'persist' ||
    stage === null
  )
}

function stageAtOrAfterRecognize(stage: JobStage): boolean {
  return stage === 'recognize' || stage === 'episodes' || stage === 'persist' || stage === null
}

function stageAtOrAfterEpisodes(stage: JobStage): boolean {
  return stage === 'episodes' || stage === 'persist' || stage === null
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
  const stage = job.stage
  const done = job.status === 'succeeded'

  // config completed (progress set to 10); initial job uses stage=config with progress 0
  if (
    !next.imported &&
    (job.progress >= 10 ||
      stage === 'metadata' ||
      stageAtOrAfterListFiles(stage) ||
      done)
  ) {
    log(`imported folder ${folder}`)
    next.imported = true
  }

  if (kind !== null) {
    // listFiles completed → start recognition
    if (!next.recognizingMedia && (stage === 'listFiles' || stageAtOrAfterRecognize(stage) || done)) {
      log(`recognizing ${kind}`)
      next.recognizingMedia = true
    }

    // recognize completed
    if (
      !next.recognizedMedia &&
      (stageAtOrAfterRecognize(stage) || done) &&
      stage !== 'listFiles' &&
      stage !== 'metadata' &&
      stage !== 'config'
    ) {
      if (job.recognizedTitle) {
        log(`recognized ${kind} "${job.recognizedTitle}"`)
        next.recognizedOk = true
      } else {
        log(`recognition completed and no ${kind} was recognized.`)
      }
      next.recognizedMedia = true
    }

    // episodes only when a show/movie was actually recognized
    if (
      !next.recognizingEpisodes &&
      next.recognizedOk &&
      (stageAtOrAfterRecognize(stage) || done)
    ) {
      log('recognizing episodes')
      next.recognizingEpisodes = true
    }

    if (!next.recognizedEpisodes && next.recognizingEpisodes && (stageAtOrAfterEpisodes(stage) || done)) {
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
