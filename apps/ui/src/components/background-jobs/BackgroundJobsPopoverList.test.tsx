import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackgroundJobsPopoverList } from './BackgroundJobsPopoverList'
import type { BackgroundJob, DownloadVideoBackgroundJob } from '@/types/background-jobs'
import type { YtdlpDownloadProgress } from '@/hooks/useYtdlpDownloadProgressQuery'
import type { ReactNode } from 'react'

const openLogDialog = vi.fn()
const stopJob = vi.fn()
const removeJob = vi.fn().mockResolvedValue(undefined)

// Mock the yt-dlp progress hook so tests don't need a real QueryClient
// with network fetch. Each test can set mockProgress to simulate log data.
let mockProgress: YtdlpDownloadProgress | null = null
vi.mock('@/hooks/useYtdlpDownloadProgressQuery', () => ({
  useYtdlpDownloadProgressQuery: () => ({ progress: mockProgress, isPending: false, isFetching: false, error: null }),
  parseYtdlpProgressLine: null,
  extractLatestProgress: null,
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: ReactNode
    onSelect?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'statusBar.backgroundJobs.status.pending') return 'pending'
      if (key === 'statusBar.backgroundJobs.status.running') return 'running'
      if (key === 'statusBar.backgroundJobs.status.succeeded') return 'succeeded'
      if (key === 'statusBar.backgroundJobs.status.failed') return 'failed'
      if (key === 'statusBar.backgroundJobs.status.aborted') return 'aborted'
      if (key === 'statusBar.backgroundJobs.status.stopped') return 'stopped'
      if (key === 'statusBar.backgroundJobs.messages.succeeded') return 'Completed successfully'
      if (key === 'statusBar.backgroundJobs.messages.failed') return 'Job failed'
      if (key === 'statusBar.backgroundJobs.messages.aborted') return 'Aborted by user'
      if (key === 'statusBar.backgroundJobs.loading') return 'Loading\u2026'
      if (key === 'statusBar.backgroundJobs.empty') return 'No background jobs'
      if (key === 'statusBar.backgroundJobs.logButton') return 'Log'
      if (key === 'statusBar.backgroundJobs.logButtonAria') return `View log for ${opts?.name ?? ''}`
      if (key === 'statusBar.backgroundJobs.abortAriaLabel') return `Abort ${opts?.name ?? ''}`
      if (key === 'statusBar.backgroundJobs.delete') return 'Delete'
      if (key === 'statusBar.backgroundJobs.deleteDisabledRunning') return 'Cannot delete while running'
      if (key === 'statusBar.backgroundJobs.jobNames.downloadVideo') return 'Download Video'
      if (key === 'statusBar.backgroundJobs.jobNames.downloadVideoEpisodes') {
        return `Download ${(opts?.count as number) ?? 0} episodes`
      }
      if (key === 'statusBar.backgroundJobs.jobNames.transcribe') return 'Transcribe'
      if (key === 'statusBar.backgroundJobs.jobNames.translate') return 'Translate'
      if (key === 'statusBar.backgroundJobs.jobNames.synthesize') return 'Synthesize'
      if (key === 'statusBar.backgroundJobs.jobNames.process') return 'Process'
      if (key === 'statusBar.backgroundJobs.jobNames.ffmpeg-convert') return 'FFmpeg Convert'
      if (key === 'statusBar.backgroundJobs.jobNames.ffmpeg-write-tags') return 'FFmpeg Tags'
      if (key === 'statusBar.backgroundJobs.jobNames.typedJob') {
        return `${opts?.type}: ${opts?.detail}`
      }
      return key
    },
  }),
}))

function makeDownloadJob(): DownloadVideoBackgroundJob {
  return {
    id: 'job-1',
    name: 'Download Video',
    status: 'running',
    progress: 0,
    type: 'download-video',
    data: {
      folder: '/tmp',
      videos: [{ url: 'https://example.com/v1', artist: 'A', title: 'T1', status: 'downloading' }],
    },
  }
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('BackgroundJobsPopoverList — download-video progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgress = null
  })

  it('renders running download-video job with speed and ETA when present in mock', () => {
    mockProgress = {
      percent: 42.5,
      speedBps: 2_500_000,
      etaSeconds: 95,
      downloadedBytes: null,
      totalBytes: null,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const job: BackgroundJob = makeDownloadJob()

    renderWithQuery(
      <BackgroundJobsPopoverList
        jobs={[job]}
        isLoading={false}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-progress')).toBeInTheDocument()
    expect(screen.getByTestId('background-job-job-1-speed')).toHaveTextContent('2.5 MB/s')
    expect(screen.getByTestId('background-job-job-1-eta')).toHaveTextContent('1m 35s')
  })

  it('formats speed in KB/s when below 1 MB/s', () => {
    mockProgress = {
      percent: 10,
      speedBps: 500_000,
      etaSeconds: 600,
      downloadedBytes: null,
      totalBytes: null,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const job: BackgroundJob = makeDownloadJob()

    renderWithQuery(
      <BackgroundJobsPopoverList
        jobs={[job]}
        isLoading={false}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-speed')).toHaveTextContent('500 KB/s')
    expect(screen.getByTestId('background-job-job-1-eta')).toHaveTextContent('10m 0s')
  })

  it('omits speed/eta when mock returns null (no progress lines yet)', () => {
    mockProgress = null
    const job: BackgroundJob = makeDownloadJob()

    renderWithQuery(
      <BackgroundJobsPopoverList
        jobs={[job]}
        isLoading={false}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
      />,
    )

    expect(screen.queryByTestId('background-job-job-1-speed')).toBeNull()
    expect(screen.queryByTestId('background-job-job-1-eta')).toBeNull()
  })

  it('formats ETA in hours for long downloads', () => {
    mockProgress = {
      percent: 5,
      speedBps: 100_000,
      etaSeconds: 3700,
      downloadedBytes: null,
      totalBytes: null,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const job: BackgroundJob = makeDownloadJob()

    renderWithQuery(
      <BackgroundJobsPopoverList
        jobs={[job]}
        isLoading={false}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-eta')).toHaveTextContent('1h 1m')
  })
})
