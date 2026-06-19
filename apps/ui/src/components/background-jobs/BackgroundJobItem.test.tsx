import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BackgroundJobItem } from './BackgroundJobItem'
import type { BackgroundJob } from '@/types/background-jobs'
import type { YtdlpDownloadProgress } from '@/hooks/useYtdlpDownloadProgressQuery'
import type { FfmpegProgress } from '@/hooks/useFfmpegProgressQuery'

const openLogDialog = vi.fn()
const stopJob = vi.fn()
const removeJob = vi.fn().mockResolvedValue(undefined)
const stopAllJobs = vi.fn().mockResolvedValue(undefined)

let mockProgress: YtdlpDownloadProgress | null = null
let mockFfmpegProgress: FfmpegProgress | null = null
vi.mock('@/hooks/useYtdlpDownloadProgressQuery', () => ({
  useYtdlpDownloadProgressQuery: () => ({ progress: mockProgress, isPending: false, isFetching: false, error: null }),
  parseYtdlpProgressLine: null,
  extractLatestProgress: null,
}))
vi.mock('@/hooks/useFfmpegProgressQuery', () => ({
  useFfmpegProgressQuery: () => ({ progress: mockFfmpegProgress, isPending: false, isFetching: false, error: null }),
  parseFfmpegProgressLine: null,
  parseHmsTime: null,
  extractLatestFfmpegProgress: null,
  stripLogLinePrefix: null,
  findHmsToken: null,
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
    ...rest
  }: {
    children: ReactNode
    onSelect?: () => void
    disabled?: boolean
    [key: string]: unknown
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()} {...rest}>
      {children}
    </button>
  ),
  ContextMenuSeparator: ({ ...rest }: { [key: string]: unknown }) => <hr data-testid="context-menu-separator" {...rest} />,
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
      if (key === 'statusBar.backgroundJobs.logButton') return 'Log'
      if (key === 'statusBar.backgroundJobs.logButtonAria') return `View log for ${opts?.name ?? ''}`
      if (key === 'statusBar.backgroundJobs.abortAriaLabel') return `Abort ${opts?.name ?? ''}`
      if (key === 'statusBar.backgroundJobs.delete') return 'Delete'
      if (key === 'statusBar.backgroundJobs.deleteDisabledRunning') return 'Cannot delete while running'
      if (key === 'statusBar.backgroundJobs.stopAll') return 'Stop All'
      if (key === 'statusBar.backgroundJobs.jobNames.downloadVideo') return 'Download Video'
      if (key === 'statusBar.backgroundJobs.jobNames.transcribe') return 'Transcribe'
      if (key === 'statusBar.backgroundJobs.jobNames.translate') return 'Translate'
      if (key === 'statusBar.backgroundJobs.jobNames.synthesize') return 'Synthesize'
      if (key === 'statusBar.backgroundJobs.jobNames.process') return 'Process'
      if (key === 'statusBar.backgroundJobs.jobNames.importMediaLibrary') return 'Importing Media Library'
      if (key === 'statusBar.backgroundJobs.jobNames.typedJob') {
        return `${opts?.type}: ${opts?.detail}`
      }
      return key
    },
  }),
}))

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function makeGenericJob(status: BackgroundJob['status']): BackgroundJob {
  return {
    id: 'job-1',
    name: status === 'succeeded' ? 'Done' : status === 'failed' ? 'Boom' : 'Run',
    status,
    progress: status === 'running' ? 50 : status === 'succeeded' ? 100 : 0,
    type: 'generic',
    data: {},
  }
}

describe('BackgroundJobItem — context menu (Stop All)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgress = null
    mockFfmpegProgress = null
  })

  it('renders the Stop All menu item alongside the Delete menu item', () => {
    const job = makeGenericJob('running')

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-stop-all-menu')).toHaveTextContent('Stop All')
    expect(screen.getByTestId('background-job-job-1-delete-menu')).toBeInTheDocument()
    expect(screen.getByTestId('background-job-job-1-menu-separator')).toBeInTheDocument()
  })

  it('clicking Stop All invokes the stopAllJobs callback', () => {
    const job = makeGenericJob('running')

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    fireEvent.click(screen.getByTestId('background-job-job-1-stop-all-menu'))
    expect(stopAllJobs).toHaveBeenCalledTimes(1)
  })

  it('Stop All menu is always enabled (no disable logic), even on a succeeded job', () => {
    const job = makeGenericJob('succeeded')

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-stop-all-menu')).not.toBeDisabled()
  })

  it('Delete menu still removes the job and is disabled for running', () => {
    const job = makeGenericJob('running')

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-delete-menu')).toBeDisabled()

    const succeededJob = makeGenericJob('succeeded')
    succeededJob.id = 'job-2'
    renderWithQuery(
      <BackgroundJobItem
        job={succeededJob}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    const deleteBtn = screen.getByTestId('background-job-job-2-delete-menu')
    expect(deleteBtn).not.toBeDisabled()
    fireEvent.click(deleteBtn)
    expect(removeJob).toHaveBeenCalledWith('job-2')
  })

  it('renders the per-job abort button only for running jobs', () => {
    const job = makeGenericJob('running')

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-job-1-abort-button')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('background-job-job-1-abort-button'))
    expect(stopJob).toHaveBeenCalledWith('job-1')
  })
})

describe('BackgroundJobItem — import-media-library name rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgress = null
    mockFfmpegProgress = null
  })

  it('renders the translated "Importing Media Library" name for the import-media-library flow', () => {
    // The import-media-library flow in MediaLibraryImportedEventHandler calls
    // addJob(t('statusBar.backgroundJobs.jobNames.importMediaLibrary')). The
    // resulting generic BackgroundJob carries that translated string in its
    // `name` field, which the default branch of getJobDisplayName renders
    // verbatim. The test ensures the i18n key resolves to a human-readable
    // string instead of the raw key leaking into the popover.
    const job: BackgroundJob = {
      id: 'lib-1',
      name: 'Importing Media Library',
      status: 'running',
      progress: 25,
      type: 'generic',
      data: {},
    }

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByText('Importing Media Library')).toBeInTheDocument()
  })
})

describe('BackgroundJobItem — ffmpeg-convert progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgress = null
    mockFfmpegProgress = null
  })

  function makeFfmpegConvertJob(): BackgroundJob {
    return {
      id: 'ffmpeg-1',
      name: 'Convert: clip.mp4',
      status: 'running',
      progress: 0,
      type: 'ffmpeg-convert',
      data: {
        folder: '/tmp',
        inputPath: '/tmp/clip.mp4',
        inputPathPlatform: 'C:\\tmp\\clip.mp4',
        outputPath: '/tmp/clip-conv.mp4',
        outputPathPlatform: 'C:\\tmp\\clip-conv.mp4',
        outputFormat: 'mp4h264',
        preset: 'balanced',
        title: 'clip.mp4',
        executionId: 'exec-1',
      },
    }
  }

  it('renders percent and ETA when ffmpeg progress is available', () => {
    mockFfmpegProgress = {
      percent: 42.5,
      currentSeconds: 76.2,
      totalSeconds: 179.7,
      etaSeconds: 12.4,
      speedMultiplier: 8.4,
      updatedAt: Date.now(),
    }
    const job = makeFfmpegConvertJob()

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-ffmpeg-1-progress')).toBeInTheDocument()
    expect(screen.getByTestId('background-job-ffmpeg-1-eta')).toHaveTextContent('13s')
  })

  it('omits ETA element when ffmpeg progress has no eta (e.g. speed= missing)', () => {
    mockFfmpegProgress = {
      percent: 50,
      currentSeconds: 60,
      totalSeconds: 120,
      etaSeconds: null,
      speedMultiplier: null,
      updatedAt: Date.now(),
    }
    const job = makeFfmpegConvertJob()

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.queryByTestId('background-job-ffmpeg-1-eta')).toBeNull()
  })

  it('falls back to IDB job.progress when ffmpeg progress is not yet available', () => {
    mockFfmpegProgress = null
    const job = makeFfmpegConvertJob()
    job.progress = 25

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.getByTestId('background-job-ffmpeg-1-progress')).toBeInTheDocument()
    expect(screen.queryByTestId('background-job-ffmpeg-1-eta')).toBeNull()
    expect(screen.queryByTestId('background-job-ffmpeg-1-speed')).toBeNull()
  })

  it('does not render speed element for ffmpeg-convert jobs (no B/s)', () => {
    mockFfmpegProgress = {
      percent: 80,
      currentSeconds: 96,
      totalSeconds: 120,
      etaSeconds: 3,
      speedMultiplier: 8,
      updatedAt: Date.now(),
    }
    const job = makeFfmpegConvertJob()

    renderWithQuery(
      <BackgroundJobItem
        job={job}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
        stopAllJobs={stopAllJobs}
      />,
    )

    expect(screen.queryByTestId('background-job-ffmpeg-1-speed')).toBeNull()
  })
})
