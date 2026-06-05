import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TableRowDownloadVideoJob } from './TableRowDownloadVideoJob'
import type { JobTableRowData } from './MusicFileTable'
import type { YtdlpDownloadProgress } from '@/hooks/useYtdlpDownloadProgressQuery'
import type { ReactNode } from 'react'

// Mock the yt-dlp progress hook so tests don't need a real QueryClient
// with network fetch. Each test can set mockProgress to simulate log data.
let mockProgress: YtdlpDownloadProgress | null = null
let mockIsRunning = false
const hookInvocationLog: Array<{ executionId: string; isRunning: boolean }> = []

vi.mock('@/hooks/useYtdlpDownloadProgressQuery', () => ({
  useYtdlpDownloadProgressQuery: ({ executionId, isRunning }: { executionId: string; isRunning: boolean }) => {
    hookInvocationLog.push({ executionId, isRunning })
    return { progress: mockProgress, isPending: false, isFetching: false, error: null }
  },
  parseYtdlpProgressLine: null,
  extractLatestProgress: null,
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onSelect, disabled }: { children: ReactNode; onSelect?: () => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'mediaPlayer.downloadingTooltip') return 'Downloading'
      if (key === 'mediaPlayer.trackContextMenu.downloadStart') return 'Start'
      if (key === 'mediaPlayer.trackContextMenu.downloadStop') return 'Stop'
      if (key === 'mediaPlayer.trackContextMenu.downloadRemove') return 'Remove'
      return key
    },
  }),
}))

function makeRow(overrides: Partial<JobTableRowData> = {}): JobTableRowData {
  return {
    kind: 'job',
    id: 1,
    index: 0,
    jobId: 'job-123',
    executionId: 'exec-abc',
    status: 'pending',
    title: 'Test Song',
    artist: 'Test Artist',
    duration: 0,
    ...overrides,
  }
}

function renderRow(row: JobTableRowData) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TableRowDownloadVideoJob row={row} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockProgress = null
  mockIsRunning = false
  hookInvocationLog.length = 0
})

describe('TableRowDownloadVideoJob — business logic wrapper', () => {
  it('renders a progress fill with the live percent width when downloading', () => {
    mockProgress = {
      percent: 42,
      speedBps: 1_500_000,
      etaSeconds: 60,
      downloadedBytes: 5_000_000,
      totalBytes: 12_000_000,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const { container } = renderRow(makeRow({ status: 'downloading' }))

    const fill = container.querySelector('[data-testid="music-job-row-1-progress-fill"]')
    expect(fill).not.toBeNull()
    expect((fill as HTMLElement).style.width).toBe('42%')
  })

  it('does not render a progress fill when status is not downloading', () => {
    mockProgress = {
      percent: 42,
      speedBps: 1_500_000,
      etaSeconds: 60,
      downloadedBytes: 5_000_000,
      totalBytes: 12_000_000,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const { container } = renderRow(makeRow({ status: 'pending' }))

    const fill = container.querySelector('[data-testid="music-job-row-1-progress-fill"]')
    expect(fill).toBeNull()
  })

  it('clamps the percent to [0, 100]', () => {
    mockProgress = {
      percent: 250,
      speedBps: 0,
      etaSeconds: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const { container } = renderRow(makeRow({ status: 'downloading' }))
    const fill = container.querySelector('[data-testid="music-job-row-1-progress-fill"]') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('passes executionId and isRunning=true to the hook when downloading', () => {
    renderRow(makeRow({ status: 'downloading', executionId: 'exec-xyz' }))
    expect(hookInvocationLog).toEqual([{ executionId: 'exec-xyz', isRunning: true }])
  })

  it('passes isRunning=false when status is not downloading', () => {
    renderRow(makeRow({ status: 'pending', executionId: 'exec-xyz' }))
    expect(hookInvocationLog).toEqual([{ executionId: 'exec-xyz', isRunning: false }])
  })

  it('passes empty executionId when row has no executionId', () => {
    renderRow(makeRow({ status: 'downloading', executionId: undefined }))
    expect(hookInvocationLog).toEqual([{ executionId: '', isRunning: true }])
  })

  it('falls back to 0% when hook returns no progress data', () => {
    mockProgress = null
    const { container } = renderRow(makeRow({ status: 'downloading' }))
    const fill = container.querySelector('[data-testid="music-job-row-1-progress-fill"]') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('exposes data-testid and data-status on the row', () => {
    const { container } = renderRow(makeRow({ status: 'downloading' }))
    const row = container.querySelector('[data-testid="music-job-row-1"]') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.dataset.status).toBe('downloading')
  })

  it('shows downloader tooltip on the spinner when downloading', () => {
    mockProgress = {
      percent: 0,
      speedBps: 0,
      etaSeconds: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    renderRow(makeRow({ status: 'downloading' }))
    expect(screen.getByLabelText('Downloading')).toBeInTheDocument()
  })

  it('forwards live progress speed and ETA to the UI duration label', () => {
    mockProgress = {
      percent: 50,
      speedBps: 9_900_000,
      etaSeconds: 8,
      downloadedBytes: 0,
      totalBytes: 0,
      status: 'downloading',
      updatedAt: Date.now(),
    }
    const { container } = renderRow(makeRow({ status: 'downloading' }))
    // The UI composes speed/ETA into a single label for the duration cell.
    // Verify the formatted label is rendered (9.9 MB/s · 8s).
    expect(container.textContent).toContain('9.9 MB/s')
    expect(container.textContent).toContain('8s')
  })
})
