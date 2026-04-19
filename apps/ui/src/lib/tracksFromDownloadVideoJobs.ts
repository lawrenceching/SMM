import type { Track } from '@/components/MediaPlayer'
import type { DownloadVideoBackgroundJob, DownloadVideoItemStatus } from '@/types/background-jobs'
import type { DownloadJobRecord } from '@/lib/downloadTaskDb'

function stableTempTrackId(jobId: string, itemIndex: number): number {
  let h = 5381
  for (let i = 0; i < jobId.length; i++) {
    h = ((h << 5) + h + jobId.charCodeAt(i)) | 0
  }
  return -Math.abs((h ^ (itemIndex * 4099)) | 0)
}

function mapItemStatus(s: DownloadVideoItemStatus): NonNullable<Track['status']> {
  switch (s) {
    case 'succeeded':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'downloading':
      return 'downloading'
    default:
      return 'pending'
  }
}

/**
 * Maps persisted download-video jobs to temporary {@link Track} rows for the music table.
 */
export function tracksFromDownloadJobRecords(records: DownloadJobRecord[]): Track[] {
  return records.flatMap((record) => {
    if (record.type !== 'download-video') return []

    let videos: Array<{ url: string; title: string; artist: string; status: string }>
    try {
      const parsed = JSON.parse(record.data || '{}')
      videos = parsed.videos || []
    } catch {
      return []
    }

    return videos.map((item, index) => {
      const itemStatus = mapItemStatus(item.status as DownloadVideoItemStatus)
      return {
        id: stableTempTrackId(record.id, index),
        title: item.title?.trim() || item.url,
        artist: item.artist?.trim() || '',
        duration: 0,
        thumbnail: '',
        addedDate: new Date(record.createdAt),
        path: undefined,
        url: item.url,
        jobId: record.id,
        status: record.status === 'stopped' ? 'stopped' as const
          : record.status === 'aborted' ? 'stopped' as const
          : itemStatus,
      }
    })
  })
}

export function tracksFromDownloadVideoJobs(jobs: DownloadVideoBackgroundJob[]): Track[] {
  return jobs.flatMap((job) =>
    job.data.videos.map((item, index) => ({
      id: stableTempTrackId(job.id, index),
      title: item.title.trim() || item.url,
      artist: item.artist.trim(),
      duration: 0,
      thumbnail: '',
      addedDate: new Date(),
      path: undefined,
      url: item.url,
      jobId: job.id,
      status: mapItemStatus(item.status),
    }))
  )
}

/**
 * Appends job-backed rows after library tracks, hiding completed job rows once the file appears in the library.
 */
export function mergeLibraryTracksWithJobTracks(libraryTracks: Track[], jobTracks: Track[]): Track[] {
  const pathSet = new Set(
    libraryTracks.map((t) => t.path).filter((p): p is string => Boolean(p?.trim()))
  )
  const filteredJob = jobTracks.filter((t) => {
    if (t.status === 'completed' && t.path && pathSet.has(t.path)) {
      return false
    }
    return true
  })
  return [...libraryTracks, ...filteredJob]
}
