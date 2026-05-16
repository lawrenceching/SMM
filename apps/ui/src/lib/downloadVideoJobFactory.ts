import type {
  DownloadVideoBackgroundJob,
  DownloadVideoBackgroundJobData,
  DownloadVideoJobVideo,
  JobStatus,
} from '@/types/background-jobs'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface CreateDownloadVideoJobInput {
  name: string
  folder: string
  urls: string[]
  /** Per-URL display metadata (e.g. episode titles) */
  itemMeta?: Array<{ title?: string; artist?: string }>
  /** yt-dlp `-f` format selector for all videos in the job. */
  ytdlpFormat?: string
}

export function buildDownloadVideoJob(input: CreateDownloadVideoJobInput): DownloadVideoBackgroundJob {
  const videos: DownloadVideoJobVideo[] = input.urls.map((url, i) => ({
    url,
    title: input.itemMeta?.[i]?.title?.trim() ?? '',
    artist: input.itemMeta?.[i]?.artist?.trim() ?? '',
    status: 'pending' as const,
  }))

  const format = input.ytdlpFormat?.trim()
  const data: DownloadVideoBackgroundJobData = {
    folder: input.folder,
    videos,
    ...(format ? { ytdlpFormat: format } : {}),
  }

  return {
    id: newJobId(),
    name: input.name,
    status: 'pending',
    progress: 0,
    type: 'download-video',
    data,
  }
}

export function recomputeDownloadVideoJobProgress(data: DownloadVideoBackgroundJobData): number {
  if (data.videos.length === 0) return 0
  const done = data.videos.filter((i) => i.status === 'succeeded' || i.status === 'failed').length
  return (done / data.videos.length) * 100
}

export function deriveDownloadVideoJobStatus(data: DownloadVideoBackgroundJobData): JobStatus {
  if (data.videos.length === 0) return 'pending'
  if (data.videos.some((i) => i.status === 'failed')) return 'failed'
  if (data.videos.every((i) => i.status === 'succeeded')) return 'succeeded'
  if (data.videos.some((i) => i.status === 'downloading')) return 'running'
  if (data.videos.some((i) => i.status === 'pending')) return 'pending'
  return 'succeeded'
}
