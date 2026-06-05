import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BackgroundJobItem } from './BackgroundJobItem'
import type { BackgroundJob } from '@/types/background-jobs'
import type { YtdlpDownloadProgress } from '@/hooks/useYtdlpDownloadProgressQuery'

const openLogDialog = vi.fn()
const stopJob = vi.fn()
const removeJob = vi.fn().mockResolvedValue(undefined)
const stopAllJobs = vi.fn().mockResolvedValue(undefined)

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
