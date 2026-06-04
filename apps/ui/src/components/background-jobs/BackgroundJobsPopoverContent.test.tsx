import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopoverContent'

const openLogDialog = vi.fn()

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
const mockStopJob = vi.fn()
const mockRemoveJob = vi.fn().mockResolvedValue(undefined)
const mockClearRemovableJobs = vi.fn().mockResolvedValue(undefined)
const mockRefreshFromIndexedDB = vi.fn().mockResolvedValue(undefined)

vi.mock('@/providers/dialog-provider', () => ({
  useDialogs: () => ({
    logDialog: [openLogDialog, vi.fn()],
  }),
}))

vi.mock('@/hooks/useJobManager', () => ({
  useJobManager: vi.fn(),
}))



vi.mock('@/stores/statusbarStore', () => ({
  useStatusbarStore: vi.fn(),
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
    ...props
  }: {
    children: React.ReactNode
    onSelect?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'statusBar.backgroundJobs.title') return 'Background Jobs'
      if (key === 'statusBar.backgroundJobs.subtitle') return 'subtitle'
      if (key === 'statusBar.backgroundJobs.empty') return 'empty'
      if (key === 'statusBar.backgroundJobs.delete') return 'Delete'
      if (key === 'statusBar.backgroundJobs.clearFinished') return 'Clear'
      if (key === 'statusBar.backgroundJobs.clearFinishedTooltip') return 'Remove completed jobs'
      if (key === 'statusBar.backgroundJobs.clearFinishedAria') return 'Remove completed jobs'
      if (key === 'statusBar.backgroundJobs.logButton') return 'Log'
      if (key === 'statusBar.backgroundJobs.logButtonAria') return `log-${opts?.name ?? ''}`
      if (key === 'statusBar.backgroundJobs.jobNames.transcribe') return 'Transcribe'
      if (key === 'statusBar.backgroundJobs.jobNames.translate') return 'Translate'
      if (key === 'statusBar.backgroundJobs.jobNames.synthesize') return 'Synthesize'
      if (key === 'statusBar.backgroundJobs.jobNames.process') return 'Process'
      if (key === 'statusBar.backgroundJobs.jobNames.downloadVideo') return 'Download Video'
      if (key === 'statusBar.backgroundJobs.jobNames.downloadVideoEpisodes') {
        return `Download ${opts?.count} episodes`
      }
      if (key === 'statusBar.backgroundJobs.jobNames.typedJob') {
        return `${opts?.type}: ${opts?.detail}`
      }
      if (key.startsWith('statusBar.backgroundJobs.status.')) return 'status'
      if (key.startsWith('statusBar.backgroundJobs.messages.')) return 'msg'
      if (key === 'statusBar.backgroundJobs.abortAriaLabel') return 'abort'
      return key
    },
  }),
}))

import { useJobManager } from '@/hooks/useJobManager'
import { useStatusbarStore } from '@/stores/statusbarStore'
import type { BackgroundJob } from '@/types/background-jobs'

const mockUseJobManager = useJobManager as unknown as ReturnType<typeof vi.fn>
const mockUseStatusbarStore = useStatusbarStore as unknown as ReturnType<typeof vi.fn>

function mockPopoverJobs(jobs: BackgroundJob[], isPopoverOpen = true) {
  mockUseJobManager.mockReturnValue({
    jobs,
    stopJob: mockStopJob,
    removeJob: mockRemoveJob,
    clearRemovableJobs: mockClearRemovableJobs,
    refreshFromIndexedDB: mockRefreshFromIndexedDB,
  })
  mockUseStatusbarStore.mockImplementation((selector?: (s: { isBackgroundJobsPopoverOpen: boolean }) => unknown) => {
    const state = { isBackgroundJobsPopoverOpen: isPopoverOpen }
    return typeof selector === 'function' ? selector(state) : state
  })
}

describe('BackgroundJobsPopoverContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows log button when subtitle job has executionId and is not running', () => {
    mockPopoverJobs([
        {
          id: 'j1',
          name: 'Transcribe: My job',
          status: 'succeeded',
          progress: 100,
          type: 'transcribe',
          data: {
            folder: '/f',
            mediaPath: '/m.mp3',
            mediaPathPlatform: 'C:/m.mp3',
            title: 't',
            provider: 'videoCaptioner',
            executionId: '00000000-0000-4000-8000-000000000001',
          },
        },
      ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j1-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000001',
      jobTitle: 'Transcribe: My job',
      isRunning: false,
    })
  })

  it('shows log button when running job has executionId and passes isRunning true to openLogDialog', () => {
    mockPopoverJobs([
        {
          id: 'j2',
          name: 'Translate: Run',
          status: 'running',
          progress: 50,
          type: 'translate',
          data: {
            folder: '/f',
            subtitlePath: '/a.srt',
            subtitlePathPlatform: 'C:/a.srt',
            title: 't',
            translator: 'bing',
            targetLanguage: 'en',
            executionId: '00000000-0000-4000-8000-000000000002',
          },
        },
      ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j2-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000002',
      jobTitle: 'Translate: Run',
      isRunning: true,
    })
    const abortBtn = screen.getByTestId('background-job-j2-abort-button')
    expect(abortBtn).toBeInTheDocument()
    fireEvent.click(abortBtn)
    expect(mockStopJob).toHaveBeenCalledWith('j2')
  })

  it('shows log button when download-video job has executionId', () => {
    mockPopoverJobs([
        {
          id: 'j3',
          name: 'Download Video',
          status: 'running',
          progress: 30,
          type: 'download-video',
          data: {
            folder: 'C:/music',
            videos: [{ url: 'https://example.com/v', title: 'My Video', artist: 'a', status: 'downloading' }],
            executionId: '00000000-0000-4000-8000-000000000003',
          },
        },
      ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j3-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000003',
      jobTitle: 'My Video',
      isRunning: true,
    })
  })

  it('delete menu removes succeeded job', () => {
    mockPopoverJobs([
      {
        id: 'j-del',
        name: 'Done',
        status: 'succeeded',
        progress: 100,
        type: 'generic',
        data: {},
      },
    ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const deleteBtn = screen.getByTestId('background-job-j-del-delete-menu')
    expect(deleteBtn).not.toBeDisabled()
    fireEvent.click(deleteBtn)
    expect(mockRemoveJob).toHaveBeenCalledWith('j-del')
  })

  it('delete menu removes pending job', () => {
    mockPopoverJobs([
      {
        id: 'j-pending',
        name: 'Queued',
        status: 'pending',
        progress: 0,
        type: 'generic',
        data: {},
      },
    ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const deleteBtn = screen.getByTestId('background-job-j-pending-delete-menu')
    expect(deleteBtn).not.toBeDisabled()
    fireEvent.click(deleteBtn)
    expect(mockRemoveJob).toHaveBeenCalledWith('j-pending')
  })

  it('delete menu is disabled for running job', () => {
    mockPopoverJobs([
      {
        id: 'j-run',
        name: 'Run',
        status: 'running',
        progress: 10,
        type: 'generic',
        data: {},
      },
    ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    expect(screen.getByTestId('background-job-j-run-delete-menu')).toBeDisabled()
  })

  it('clear button clears removable jobs when present', () => {
    mockPopoverJobs([
      {
        id: 'j-run',
        name: 'Run',
        status: 'running',
        progress: 10,
        type: 'generic',
        data: {},
      },
      {
        id: 'j-done',
        name: 'Done',
        status: 'failed',
        progress: 0,
        type: 'generic',
        data: {},
      },
    ])

    renderWithQuery(<BackgroundJobsPopoverContent />)

    const clearBtn = screen.getByTestId('background-jobs-clear-button')
    fireEvent.click(clearBtn)
    expect(mockClearRemovableJobs).toHaveBeenCalled()
  })

  it('clear button is hidden when only running jobs exist', () => {
    mockPopoverJobs([
      {
        id: 'j-run-only',
        name: 'Run',
        status: 'running',
        progress: 10,
        type: 'generic',
        data: {},
      },
    ])
    renderWithQuery(<BackgroundJobsPopoverContent />)
    expect(screen.queryByTestId('background-jobs-clear-button')).not.toBeInTheDocument()
  })

  it('clear button is visible when pending jobs exist', () => {
    mockPopoverJobs([
      {
        id: 'j-pending',
        name: 'Queued',
        status: 'pending',
        progress: 0,
        type: 'generic',
        data: {},
      },
    ])
    renderWithQuery(<BackgroundJobsPopoverContent />)
    expect(screen.getByTestId('background-jobs-clear-button')).toBeInTheDocument()
  })

  it('clear button is hidden while loading', () => {
    mockPopoverJobs([], true)
    renderWithQuery(<BackgroundJobsPopoverContent />)
    expect(screen.queryByTestId('background-jobs-clear-button')).not.toBeInTheDocument()
  })
})
