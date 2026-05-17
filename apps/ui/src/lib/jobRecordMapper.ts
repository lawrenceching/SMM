import { Path } from '@core/path'
import {
  type BackgroundJob,
  type DownloadVideoBackgroundJob,
  type DownloadVideoBackgroundJobData,
  type ProcessBackgroundJob,
  type ProcessBackgroundJobData,
  type SynthesizeBackgroundJob,
  type SynthesizeBackgroundJobData,
  type TranscribeBackgroundJob,
  type TranscribeBackgroundJobData,
  type TestDelayBackgroundJob,
  type TestDelayBackgroundJobData,
  type TranslateBackgroundJob,
  type TranslateBackgroundJobData,
  isDownloadVideoJob,
  isProcessBackgroundJob,
  isSynthesizeBackgroundJob,
  isTestDelayBackgroundJob,
  isTranscribeBackgroundJob,
  isTranslateBackgroundJob,
} from '@/types/background-jobs'
import {
  getAllJobs,
  selectRecordsForBackgroundJobsUi,
  type TaskJobRecord,
} from '@/lib/downloadTaskDb'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

function applyCommandLogCorrelation<T extends { executionId?: string; logRelativePath?: string }>(
  data: T,
  parsed: Record<string, unknown>,
): void {
  if (typeof parsed.executionId === 'string' && parsed.executionId) {
    data.executionId = parsed.executionId
  }
  if (typeof parsed.logRelativePath === 'string' && parsed.logRelativePath) {
    data.logRelativePath = parsed.logRelativePath
  }
}

export function jobRecordToBackgroundJob(record: TaskJobRecord): BackgroundJob | null {
  if (record.type === 'transcribe') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const mediaPath = typeof parsed.mediaPath === 'string' ? parsed.mediaPath : ''
    const mediaPathPlatform =
      typeof parsed.mediaPathPlatform === 'string' ? parsed.mediaPathPlatform : mediaPath
    const provider: TranscribeBackgroundJobData['provider'] =
      parsed.provider === 'tencentAsr' ? 'tencentAsr' : 'videoCaptioner'
    const data: TranscribeBackgroundJobData = {
      folder: (typeof parsed.folder === 'string' ? parsed.folder : record.folder) || '',
      mediaPath,
      mediaPathPlatform,
      title: typeof parsed.title === 'string' ? parsed.title : record.name,
      provider,
    }
    if (provider === 'tencentAsr' && parsed.tencentAsr && typeof parsed.tencentAsr === 'object') {
      data.tencentAsr = parsed.tencentAsr as TranscribeBackgroundJobData['tencentAsr']
    }
    if (parsed.videoCaptioner && typeof parsed.videoCaptioner === 'object') {
      data.videoCaptioner = parsed.videoCaptioner as TranscribeBackgroundJobData['videoCaptioner']
    }
    applyCommandLogCorrelation(data, parsed)
    const job: TranscribeBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as TranscribeBackgroundJob['status'],
      progress: record.progress,
      type: 'transcribe',
      data,
    }
    return job
  }

  if (record.type === 'translate') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const subtitlePathRaw = typeof parsed.subtitlePath === 'string' ? parsed.subtitlePath : ''
    const subtitlePath = subtitlePathRaw ? Path.posix(subtitlePathRaw) : ''
    const subtitlePathPlatform =
      typeof parsed.subtitlePathPlatform === 'string' ? parsed.subtitlePathPlatform : subtitlePath
    let translator: TranslateBackgroundJobData['translator'] = 'bing'
    if (parsed.translator === 'google' || parsed.translator === 'llm') {
      translator = parsed.translator
    }
    const data: TranslateBackgroundJobData = {
      folder: (typeof parsed.folder === 'string' ? parsed.folder : record.folder) || '',
      subtitlePath,
      subtitlePathPlatform,
      title: typeof parsed.title === 'string' ? parsed.title : record.name,
      translator,
      targetLanguage: typeof parsed.targetLanguage === 'string' ? parsed.targetLanguage : '',
    }
    if (typeof parsed.mediaPath === 'string' && parsed.mediaPath.trim()) {
      const mp = Path.posix(parsed.mediaPath.trim())
      data.mediaPath = mp
      data.mediaPathPlatform =
        typeof parsed.mediaPathPlatform === 'string' && parsed.mediaPathPlatform.trim()
          ? parsed.mediaPathPlatform
          : Path.toPlatformPath(mp)
    }
    if (parsed.reflect === true) {
      data.reflect = true
    }
    const layout = parsed.layout
    if (
      layout === 'target-above' ||
      layout === 'source-above' ||
      layout === 'target-only' ||
      layout === 'source-only'
    ) {
      data.layout = layout
    }
    if (parsed.llm && typeof parsed.llm === 'object') {
      data.llm = parsed.llm as TranslateBackgroundJobData['llm']
    }
    applyCommandLogCorrelation(data, parsed)
    const job: TranslateBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as TranslateBackgroundJob['status'],
      progress: record.progress,
      type: 'translate',
      data,
    }
    return job
  }

  if (record.type === 'synthesize') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const videoPathRaw = typeof parsed.videoPath === 'string' ? parsed.videoPath : ''
    const videoPath = videoPathRaw ? Path.posix(videoPathRaw) : ''
    const videoPathPlatform =
      typeof parsed.videoPathPlatform === 'string' ? parsed.videoPathPlatform : videoPath
    const subtitlePathRaw = typeof parsed.subtitlePath === 'string' ? parsed.subtitlePath : ''
    const subtitlePath = subtitlePathRaw ? Path.posix(subtitlePathRaw) : ''
    const subtitlePathPlatform =
      typeof parsed.subtitlePathPlatform === 'string' ? parsed.subtitlePathPlatform : subtitlePath
    const data: SynthesizeBackgroundJobData = {
      folder: (typeof parsed.folder === 'string' ? parsed.folder : record.folder) || '',
      videoPath,
      videoPathPlatform,
      subtitlePath,
      subtitlePathPlatform,
      title: typeof parsed.title === 'string' ? parsed.title : record.name,
    }
    if (typeof parsed.mediaPath === 'string' && parsed.mediaPath.trim()) {
      const mp = Path.posix(parsed.mediaPath.trim())
      data.mediaPath = mp
      data.mediaPathPlatform =
        typeof parsed.mediaPathPlatform === 'string' && parsed.mediaPathPlatform.trim()
          ? parsed.mediaPathPlatform
          : Path.toPlatformPath(mp)
    } else if (videoPath) {
      data.mediaPath = videoPath
      data.mediaPathPlatform = videoPathPlatform
    }
    if (parsed.subtitleMode === 'soft' || parsed.subtitleMode === 'hard') {
      data.subtitleMode = parsed.subtitleMode
    }
    if (
      parsed.quality === 'ultra' ||
      parsed.quality === 'high' ||
      parsed.quality === 'medium' ||
      parsed.quality === 'low'
    ) {
      data.quality = parsed.quality
    }
    if (typeof parsed.style === 'string' && parsed.style.trim()) {
      data.style = parsed.style.trim()
    }
    if (parsed.renderMode === 'ass' || parsed.renderMode === 'rounded') {
      data.renderMode = parsed.renderMode
    }
    const layout = parsed.layout
    if (
      layout === 'target-above' ||
      layout === 'source-above' ||
      layout === 'target-only' ||
      layout === 'source-only'
    ) {
      data.layout = layout
    }
    applyCommandLogCorrelation(data, parsed)
    const job: SynthesizeBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as SynthesizeBackgroundJob['status'],
      progress: record.progress,
      type: 'synthesize',
      data,
    }
    return job
  }

  if (record.type === 'process') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const mediaPathRaw = typeof parsed.mediaPath === 'string' ? parsed.mediaPath : ''
    const mediaPath = mediaPathRaw ? Path.posix(mediaPathRaw) : ''
    const mediaPathPlatform =
      typeof parsed.mediaPathPlatform === 'string' ? parsed.mediaPathPlatform : mediaPath
    const data: ProcessBackgroundJobData = {
      folder: (typeof parsed.folder === 'string' ? parsed.folder : record.folder) || '',
      mediaPath,
      mediaPathPlatform,
      title: typeof parsed.title === 'string' ? parsed.title : record.name,
    }
    const asr = parsed.asr
    if (asr === 'bijian' || asr === 'jianying' || asr === 'whisper-cpp') {
      data.asr = asr
    }
    if (typeof parsed.language === 'string' && parsed.language.trim()) {
      data.language = parsed.language.trim()
    }
    if (parsed.wordTimestamps === true) {
      data.wordTimestamps = true
    }
    const fmt = parsed.format
    if (fmt === 'srt' || fmt === 'ass' || fmt === 'txt' || fmt === 'json') {
      data.format = fmt
    }
    if (parsed.noOptimize === true) data.noOptimize = true
    if (parsed.noTranslate === true) data.noTranslate = true
    if (parsed.noSplit === true) data.noSplit = true
    const tr = parsed.translator
    if (tr === 'bing' || tr === 'google' || tr === 'llm') {
      data.translator = tr
    }
    if (typeof parsed.targetLanguage === 'string' && parsed.targetLanguage.trim()) {
      data.targetLanguage = parsed.targetLanguage.trim()
    }
    if (parsed.reflect === true) data.reflect = true
    const layout = parsed.layout
    if (
      layout === 'target-above' ||
      layout === 'source-above' ||
      layout === 'target-only' ||
      layout === 'source-only'
    ) {
      data.layout = layout
    }
    if (typeof parsed.prompt === 'string' && parsed.prompt.trim()) {
      data.prompt = parsed.prompt.trim()
    }
    if (parsed.llm && typeof parsed.llm === 'object') {
      data.llm = parsed.llm as ProcessBackgroundJobData['llm']
    }
    if (parsed.noSynthesize === true) data.noSynthesize = true
    const sm = parsed.subtitleMode
    if (sm === 'soft' || sm === 'hard') data.subtitleMode = sm
    const q = parsed.quality
    if (q === 'ultra' || q === 'high' || q === 'medium' || q === 'low') data.quality = q
    if (typeof parsed.style === 'string' && parsed.style.trim()) {
      data.style = parsed.style.trim()
    }
    const rm = parsed.renderMode
    if (rm === 'ass' || rm === 'rounded') data.renderMode = rm
    const sl = parsed.synthesizeLayout
    if (
      sl === 'target-above' ||
      sl === 'source-above' ||
      sl === 'target-only' ||
      sl === 'source-only'
    ) {
      data.synthesizeLayout = sl
    }
    applyCommandLogCorrelation(data, parsed)
    const job: ProcessBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as ProcessBackgroundJob['status'],
      progress: record.progress,
      type: 'process',
      data,
    }
    return job
  }

  if (record.type === 'test-delay') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const delayMs = typeof parsed.delayMs === 'number' ? parsed.delayMs : 0
    const outcome: TestDelayBackgroundJobData['outcome'] =
      parsed.outcome === 'failed' ? 'failed' : 'succeeded'
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : undefined
    const job: TestDelayBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as TestDelayBackgroundJob['status'],
      progress: record.progress,
      type: 'test-delay',
      data: { delayMs, outcome, startedAt },
    }
    return job
  }

  if (record.type !== 'download-video') {
    return null
  }

  let data: DownloadVideoBackgroundJobData
  try {
    const parsed = JSON.parse(record.data || '{}') as Record<string, unknown> & {
      folder?: string
      videos?: unknown[]
    }
    data = {
      folder: parsed.folder || record.folder || '',
      videos: (parsed.videos || []) as DownloadVideoBackgroundJobData['videos'],
    }
    applyCommandLogCorrelation(data, parsed)
  } catch {
    data = { folder: record.folder || '', videos: [] }
  }

  const job: DownloadVideoBackgroundJob = {
    id: record.id,
    name: record.name,
    status: record.status as DownloadVideoBackgroundJob['status'],
    progress: record.progress,
    type: 'download-video',
    data,
  }
  return job
}

function isPersistedFromIdbJob(job: BackgroundJob): boolean {
  return (
    isDownloadVideoJob(job) ||
    isTranscribeBackgroundJob(job) ||
    isTranslateBackgroundJob(job) ||
    isSynthesizeBackgroundJob(job) ||
    isProcessBackgroundJob(job) ||
    isTestDelayBackgroundJob(job)
  )
}

/**
 * Sync a set of fresh `TaskJobRecord`s to the Zustand `useBackgroundJobsStore`.
 * Persisted IDB jobs are replaced wholesale; in-memory generic jobs are preserved.
 */
export function syncJobRecordsToStore(records: TaskJobRecord[]): void {
  const mapped: BackgroundJob[] = []
  for (const record of records) {
    const job = jobRecordToBackgroundJob(record)
    if (job) mapped.push(job)
  }

  useBackgroundJobsStore.setState((state) => ({
    jobs: [...state.jobs.filter((j) => !isPersistedFromIdbJob(j)), ...mapped],
  }))
}

/**
 * Load all jobs from IndexedDB, filter to within-one-hour, and return.
 * Also syncs to the Zustand store as a side-effect.
 */
export async function loadAndSyncJobs(): Promise<TaskJobRecord[]> {
  const records = await getAllJobs()
  const filtered = selectRecordsForBackgroundJobsUi(records)
  syncJobRecordsToStore(filtered)
  return filtered
}
