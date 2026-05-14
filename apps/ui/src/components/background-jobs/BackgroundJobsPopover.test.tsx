import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopover'

const openLogDialog = vi.fn()

vi.mock('@/providers/dialog-provider', () => ({
  useDialogs: () => ({
    logDialog: [openLogDialog, vi.fn()],
  }),
}))

vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: vi.fn(),
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

import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

const mockStore = useBackgroundJobsStore as unknown as ReturnType<typeof vi.fn>

describe('BackgroundJobsPopoverContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows log button when subtitle job has executionId and is not running', () => {
    mockStore.mockReturnValue({
      jobs: [
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
      ],
      abortJob: vi.fn(),
    })

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
    mockStore.mockReturnValue({
      jobs: [
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
      ],
      abortJob: vi.fn(),
    })

    render(<BackgroundJobsPopoverContent />)

    const logBtn = screen.getByTestId('background-job-j2-log-button')
    expect(logBtn).toBeInTheDocument()
    fireEvent.click(logBtn)
    expect(openLogDialog).toHaveBeenCalledWith({
      executionId: '00000000-0000-4000-8000-000000000002',
      jobTitle: 'Run',
      isRunning: true,
    })
    expect(screen.getByTestId('background-job-j2-abort-button')).toBeInTheDocument()
  })
})
