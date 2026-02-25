import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBackgroundJobsIndicator } from './useBackgroundJobsIndicator'
import type { BackgroundJob } from '@/types/background-jobs'

vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: vi.fn(),
}))

import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

const mockUseBackgroundJobsStore = useBackgroundJobsStore as unknown as ReturnType<typeof vi.fn>

describe('useBackgroundJobsIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when jobs array is empty', () => {
    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => [],
      jobs: [],
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(false)
    expect(result.current.runningCount).toBe(0)
    expect(result.current.activeCount).toBe(0)
  })

  it('should not render when all jobs are completed', () => {
    const completedJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'succeeded', progress: 100 },
      { id: '2', name: 'Job 2', status: 'failed', progress: 0 },
    ]

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => [],
      jobs: completedJobs,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(false)
    expect(result.current.activeCount).toBe(0)
  })

  it('should render with running job count', () => {
    const runningJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'running', progress: 50 },
    ]

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => runningJobs,
      jobs: runningJobs,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.isRunning).toBe(true)
    expect(result.current.runningCount).toBe(1)
    expect(result.current.activeCount).toBe(1)
  })

  it('should render with pending job count', () => {
    const pendingJobs: BackgroundJob[] = [
      { id: '1', name: 'Job 1', status: 'pending', progress: 0 },
    ]

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => [],
      jobs: pendingJobs,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.runningCount).toBe(0)
    expect(result.current.activeCount).toBe(1)
  })

  it('should render with mixed running and pending jobs', () => {
    const mixedJobs: BackgroundJob[] = [
      { id: '1', name: 'Running Job', status: 'running', progress: 50 },
      { id: '2', name: 'Pending Job', status: 'pending', progress: 0 },
      { id: '3', name: 'Completed Job', status: 'succeeded', progress: 100 },
    ]

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => mixedJobs.filter((j) => j.status === 'running'),
      jobs: mixedJobs,
      isPopoverOpen: true,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(true)
    expect(result.current.isRunning).toBe(true)
    expect(result.current.runningCount).toBe(1)
    expect(result.current.activeCount).toBe(2) // running + pending
    expect(result.current.isPopoverOpen).toBe(true)
  })

  it('should return setPopoverOpen function', () => {
    const mockSetPopoverOpen = vi.fn()

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => [],
      jobs: [{ id: '1', name: 'Job', status: 'running', progress: 50 }],
      isPopoverOpen: false,
      setPopoverOpen: mockSetPopoverOpen,
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.setPopoverOpen).toBe(mockSetPopoverOpen)

    act(() => {
      result.current.setPopoverOpen(true)
    })

    expect(mockSetPopoverOpen).toHaveBeenCalledWith(true)
  })

  it('should handle aborted jobs as active (not running)', () => {
    const abortedJobs: BackgroundJob[] = [
      { id: '1', name: 'Aborted Job', status: 'aborted', progress: 30 },
    ]

    mockUseBackgroundJobsStore.mockReturnValue({
      getRunningJobs: () => [],
      jobs: abortedJobs,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
    })

    const { result } = renderHook(() => useBackgroundJobsIndicator())

    expect(result.current.shouldRender).toBe(false) // aborted is not running or pending
    expect(result.current.activeCount).toBe(0)
  })
})
