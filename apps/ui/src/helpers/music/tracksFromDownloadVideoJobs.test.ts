import { describe, it, expect } from 'vitest'
import type { DownloadVideoBackgroundJob } from '@/types/background-jobs'
import type { Track } from '@/components/MediaPlayer'
import { mergeLibraryTracksWithJobTracks, tracksFromDownloadVideoJobs } from './tracksFromDownloadVideoJobs'

function makeJob(overrides: Partial<DownloadVideoBackgroundJob> = {}): DownloadVideoBackgroundJob {
  const base: DownloadVideoBackgroundJob = {
    id: 'j1',
    name: 'n',
    status: 'running',
    progress: 0,
    type: 'download-video',
    data: {
      folder: '/m',
      videos: [{ url: 'https://a', title: 'T', artist: '', status: 'downloading' }],
    },
  }
  return {
    ...base,
    ...overrides,
    data: { ...base.data, ...overrides.data },
  }
}

describe('tracksFromDownloadVideoJobs', () => {
  it('maps job items to temporary tracks with jobId', () => {
    const job = makeJob({ id: 'job-xyz' })
    const tracks = tracksFromDownloadVideoJobs([job])
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.jobId).toBe('job-xyz')
    expect(tracks[0]!.title).toBe('T')
    expect(tracks[0]!.status).toBe('downloading')
  })
})

describe('mergeLibraryTracksWithJobTracks', () => {
  it('drops completed job rows when the same path exists in the library', () => {
    const library: Track[] = [
      {
        id: 1,
        title: 'Local',
        artist: 'A',
        duration: 1,
        addedDate: new Date(),
        path: '/media/final.mp3',
      },
    ]
    const jobTracks: Track[] = [
      {
        id: -1,
        title: 'Tmp',
        artist: '',
        duration: 0,
        addedDate: new Date(),
        path: '/media/final.mp3',
        jobId: 'j',
        status: 'completed',
      },
    ]
    const merged = mergeLibraryTracksWithJobTracks(library, jobTracks)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.path).toBe('/media/final.mp3')
    expect(merged[0]!.jobId).toBeUndefined()
  })
})
