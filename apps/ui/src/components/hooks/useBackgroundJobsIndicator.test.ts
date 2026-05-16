import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBackgroundJobsIndicator } from './useBackgroundJobsIndicator'
import type { BackgroundJob } from '@/types/background-jobs'

const mockRefreshFromIndexedDB = vi.fn().mockResolvedValue(undefined)
const mockSetBackgroundJobsPopoverOpen = vi.fn()
const mockGetState = vi.fn()

vi.mock('@/hooks/useJobManager', () => ({
  useJobManager: vi.fn(),
}))

vi.mock('@/stores/statusbarStore', () => ({
  useStatusbarStore: vi.fn(),
}))

vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: Object.assign(vi.fn(), {
    getState: () => mockGetState(),
  }),
}))

import { useJobManager } from '@/hooks/useJobManager'
import { useStatusbarStore } from '@/stores/statusbarStore'

const mockUseJobManager = useJobManager as unknown as ReturnType<typeof vi.fn>
const mockUseStatusbarStore = useStatusbarStore as unknown as ReturnType<typeof vi.fn>

describe('useBackgroundJobsIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ jobs: [] })
    mockUseStatusbarStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isBackgroundJobsPopoverOpen: false,
        setBackgroundJobsPopoverOpen: mockSetBackgroundJobsPopoverOpen,
      }
      return typeof selector === 'function' ? selector(state) : state
    })
  })

  function mockJobs(jobs: BackgroundJob[], isPopoverOpen = false) {
    mockUseJobManager.mockReturnValue({
      jobs,
      refreshFromIndexedDB: mockRefreshFromIndexedDB,
    })
    mockUseStatusbarStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isBackgroundJobsPopoverOpen: isPopoverOpen,
        setBackgroundJobsPopoverOpen: mockSetBackgroundJobsPopoverOpen,
      }
      return typeof selector === 'function' ? selector(state) : state
    })
  }

  it('should not render when jobs array is empty', () => {
    mockJobs([])

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.runningCount).toBe(0)
    expect(result.current.activeCount).toBe(0)
    expect(result.current.statusVariant).toBe('success')
  })

  it('should render success variant when all jobs are completed', () => {
    const completedJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'succeeded', progress: 100, type: 'generic', data: {} },
      { id: '2', name: 'Job 2', status: 'failed', progress: 0, type: 'generic', data: {} },
    ]

    mockJobs(completedJobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.activeCount).toBe(0)
    expect(result.current.statusVariant).toBe('warning')
  })

  it('should render with running job count', () => {
    const runningJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'running', progress: 50, type: 'generic', data: {} },
    ]

    mockJobs(runningJobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.statusVariant).toBe('running')
    expect(result.current.runningCount).toBe(1)
    expect(result.current.activeCount).toBe(1)
  })

  it('should render with pending job count', () => {
    const pendingJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'pending', progress: 0, type: 'generic', data: {} },
    ]

    mockJobs(pendingJobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.statusVariant).toBe('success')
    expect(result.current.runningCount).toBe(0)
    expect(result.current.activeCount).toBe(1)
  })

  it('should render with mixed running and pending jobs', () => {
    const mixedJobs: BackgroundJob[] = [
      { id: '1', name: 'Running Job', status: 'running', progress: 50, type: 'generic', data: {} },
      { id: '2', name: 'Pending Job', status: 'pending', progress: 0, type: 'generic', data: {} },
      { id: '3', name: 'Completed Job', status: 'succeeded', progress: 100, type: 'generic', data: {} },
    ]

    mockJobs(mixedJobs, true)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.statusVariant).toBe('running')
    expect(result.current.runningCount).toBe(1)
    expect(result.current.activeCount).toBe(2)
    expect(result.current.isPopoverOpen).toBe(true)
  })

  it('setPopoverOpen refreshes from IndexedDB when store is empty then opens popover', async () => {
    mockJobs([{ id: '1', name: 'Job', status: 'running', progress: 50, type: 'generic', data: {} }])
    mockGetState.mockReturnValue({ jobs: [] })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    await act(async () => {
      result.current.setPopoverOpen(true)
    })

    expect(mockRefreshFromIndexedDB).toHaveBeenCalledWith('popover-open')
    expect(mockSetBackgroundJobsPopoverOpen).toHaveBeenCalledWith(true)

    await act(async () => {
      result.current.setPopoverOpen(false)
    })

    expect(mockSetBackgroundJobsPopoverOpen).toHaveBeenCalledWith(false)
  })

  it('should handle aborted jobs as warning', () => {
    const abortedJobs: BackgroundJob[] = [
      { id: '1', name: 'Aborted Job', status: 'aborted', progress: 30, type: 'generic', data: {} },
    ]

    mockJobs(abortedJobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.activeCount).toBe(0)
    expect(result.current.statusVariant).toBe('warning')
  })

  it('should prioritize running over failed/aborted', () => {
    const mixedJobs: BackgroundJob[] = [
      { id: '1', name: 'Running Job', status: 'running', progress: 20, type: 'generic', data: {} },
      { id: '2', name: 'Failed Job', status: 'failed', progress: 80, type: 'generic', data: {} },
      { id: '3', name: 'Aborted Job', status: 'aborted', progress: 30, type: 'generic', data: {} },
    ]

    mockJobs(mixedJobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.statusVariant).toBe('running')
  })

  it('should treat download-video item downloading as running', () => {
    const jobs: BackgroundJob[] = [
      {
        id: '1',
        name: 'Download Job',
        status: 'pending',
        progress: 20,
        type: 'download-video',
        data: {
          folder: '/tmp',
          videos: [
            { url: 'https://a', artist: 'A', title: 'T', status: 'downloading' },
            { url: 'https://b', artist: 'B', title: 'U', status: 'pending' },
          ],
        },
      },
    ]

    mockJobs(jobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.runningCount).toBe(1)
    expect(result.current.statusVariant).toBe('running')
  })

  it('should not treat aborted download-video with stale downloading video as running', () => {
    const jobs: BackgroundJob[] = [
      {
        id: '1',
        name: 'Aborted Download',
        status: 'aborted',
        progress: 50,
        type: 'download-video',
        data: {
          folder: '/tmp',
          videos: [
            { url: 'https://a', artist: 'A', title: 'T', status: 'downloading' },
          ],
        },
      },
    ]

    mockJobs(jobs)

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.runningCount).toBe(0)
    expect(result.current.statusVariant).toBe('warning')
  })
})
