import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopover'

const openLogDialog = vi.fn()
const mockStopJob = vi.fn()
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

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'statusBar.backgroundJobs.title') return 'Background Jobs'
      if (key === 'statusBar.backgroundJobs.subtitle') return 'subtitle'
      if (key === 'statusBar.backgroundJobs.empty') return 'empty'
      if (key === 'statusBar.backgroundJobs.logButton') return 'Log'
      if (key === 'statusBar.backgroundJobs.logButtonAria') return `log-${opts?.name ?? ''}`
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
          name: 'My job',
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

    render(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j1-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000001',
      jobTitle: 'My job',
      isRunning: false,
    })
  })

  it('shows log button when running job has executionId and passes isRunning true to openLogDialog', () => {
    mockPopoverJobs([
        {
          id: 'j2',
          name: 'Run',
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

    render(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j2-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000002',
      jobTitle: 'Run',
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
            videos: [{ url: 'https://example.com/v', title: 't', artist: 'a', status: 'downloading' }],
            executionId: '00000000-0000-4000-8000-000000000003',
          },
        },
      ])

    render(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j3-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000003',
      jobTitle: 'Download Video',
      isRunning: true,
    })
  })
})
