import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJobManager } from './useJobManager'
import type { BackgroundJob } from '@/types/background-jobs'

const mockAbortJob = vi.fn()
const mockStoreRemoveJob = vi.fn()
const mockOrchestratorStopJob = vi.fn()
const mockOrchestratorRemoveJob = vi.fn().mockResolvedValue(undefined)
const mockRefreshFromIndexedDB = vi.fn().mockResolvedValue(undefined)

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/JobOrchestratorProvider', () => ({
  useJobOrchestratorContext: vi.fn(),
}))

const mockGetState = vi.fn()

vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: Object.assign(vi.fn(), {
    getState: () => mockGetState(),
  }),
}))

const mockStopTestDelayJob = vi.fn().mockResolvedValue(undefined)
const mockClearTestDelayJobTimers = vi.fn()

vi.mock('@/lib/testDelayJobRunner', () => ({
  stopTestDelayJob: (...args: unknown[]) => mockStopTestDelayJob(...args),
  clearTestDelayJobTimers: (...args: unknown[]) => mockClearTestDelayJobTimers(...args),
}))

import { useJobOrchestratorContext } from '@/components/JobOrchestratorProvider'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

const mockUseJobOrchestratorContext = useJobOrchestratorContext as unknown as ReturnType<typeof vi.fn>
const mockUseBackgroundJobsStore = useBackgroundJobsStore as unknown as ReturnType<typeof vi.fn>

function setupStore(jobs: BackgroundJob[]) {
  mockUseBackgroundJobsStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      jobs,
      addJob: vi.fn(),
      updateJob: vi.fn(),
      patchJob: vi.fn(),
      abortJob: mockAbortJob,
      removeJob: mockStoreRemoveJob,
    }
    return typeof selector === 'function' ? selector(state) : state
  })
  mockGetState.mockReturnValue({
    jobs,
    abortJob: mockAbortJob,
    removeJob: mockStoreRemoveJob,
  })
}

describe('useJobManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseJobOrchestratorContext.mockReturnValue({
      popoverJobRecords: [],
      refreshFromIndexedDB: mockRefreshFromIndexedDB,
      isReady: true,
      createJob: vi.fn(),
      createJobs: vi.fn(),
      startJob: vi.fn(),
      stopJob: mockOrchestratorStopJob,
      removeJob: mockOrchestratorRemoveJob,
    })
    setupStore([])
  })

  it('stopJob routes generic jobs to store abortJob', () => {
    const genericJob: BackgroundJob = {
      id: 'g1',
      name: 'Import',
      status: 'running',
      progress: 0,
      type: 'generic',
      data: {},
    }
    setupStore([genericJob])

    const { result } = renderHook(() => useJobManager())
    act(() => {
      result.current.stopJob('g1')
    })

    expect(mockAbortJob).toHaveBeenCalledWith('g1')
    expect(mockOrchestratorStopJob).not.toHaveBeenCalled()
  })

  it('stopJob routes test-delay jobs to stopTestDelayJob', () => {
    const testJob: BackgroundJob = {
      id: 'td1',
      name: 'Test',
      status: 'running',
      progress: 10,
      type: 'test-delay',
      data: { delayMs: 30_000, outcome: 'failed' },
    }
    setupStore([testJob])

    const { result } = renderHook(() => useJobManager())
    act(() => {
      result.current.stopJob('td1')
    })

    expect(mockStopTestDelayJob).toHaveBeenCalledWith('td1')
    expect(mockOrchestratorStopJob).not.toHaveBeenCalled()
  })

  it('stopJob routes persisted jobs to orchestrator stopJob', () => {
    const transcribeJob: BackgroundJob = {
      id: 't1',
      name: 'Transcribe',
      status: 'running',
      progress: 10,
      type: 'transcribe',
      data: {
        folder: '/f',
        mediaPath: '/m.mp3',
        mediaPathPlatform: 'C:/m.mp3',
        title: 't',
        provider: 'videoCaptioner',
      },
    }
    setupStore([transcribeJob])

    const { result } = renderHook(() => useJobManager())
    act(() => {
      result.current.stopJob('t1')
    })

    expect(mockOrchestratorStopJob).toHaveBeenCalledWith('t1')
    expect(mockAbortJob).not.toHaveBeenCalled()
  })

  it('removeJob routes generic jobs to store removeJob', async () => {
    const genericJob: BackgroundJob = {
      id: 'g2',
      name: 'Done',
      status: 'succeeded',
      progress: 100,
      type: 'generic',
      data: {},
    }
    setupStore([genericJob])

    const { result } = renderHook(() => useJobManager())
    await act(async () => {
      await result.current.removeJob('g2')
    })

    expect(mockStoreRemoveJob).toHaveBeenCalledWith('g2')
    expect(mockOrchestratorRemoveJob).not.toHaveBeenCalled()
  })

  it('removeJob clears test-delay timers before orchestrator removeJob', async () => {
    const testJob: BackgroundJob = {
      id: 'td2',
      name: 'Test',
      status: 'succeeded',
      progress: 100,
      type: 'test-delay',
      data: { delayMs: 10_000, outcome: 'succeeded' },
    }
    setupStore([testJob])

    const { result } = renderHook(() => useJobManager())
    await act(async () => {
      await result.current.removeJob('td2')
    })

    expect(mockClearTestDelayJobTimers).toHaveBeenCalledWith('td2')
    expect(mockOrchestratorRemoveJob).toHaveBeenCalledWith('td2')
  })

  it('removeJob routes persisted jobs to orchestrator removeJob', async () => {
    const transcribeJob: BackgroundJob = {
      id: 't2',
      name: 'Transcribe',
      status: 'succeeded',
      progress: 100,
      type: 'transcribe',
      data: {
        folder: '/f',
        mediaPath: '/m.mp3',
        mediaPathPlatform: 'C:/m.mp3',
        title: 't',
        provider: 'videoCaptioner',
      },
    }
    setupStore([transcribeJob])

    const { result } = renderHook(() => useJobManager())
    await act(async () => {
      await result.current.removeJob('t2')
    })

    expect(mockOrchestratorRemoveJob).toHaveBeenCalledWith('t2')
    expect(mockStoreRemoveJob).not.toHaveBeenCalled()
  })

  it('clearRemovableJobs removes all non-running jobs', async () => {
    const jobs: BackgroundJob[] = [
      {
        id: 'r1',
        name: 'Running',
        status: 'running',
        progress: 50,
        type: 'generic',
        data: {},
      },
      {
        id: 'p1',
        name: 'Queued',
        status: 'pending',
        progress: 0,
        type: 'generic',
        data: {},
      },
      {
        id: 'd1',
        name: 'Done',
        status: 'succeeded',
        progress: 100,
        type: 'generic',
        data: {},
      },
    ]
    setupStore(jobs)

    const { result } = renderHook(() => useJobManager())
    await act(async () => {
      await result.current.clearRemovableJobs()
    })

    expect(mockStoreRemoveJob).toHaveBeenCalledTimes(2)
    expect(mockStoreRemoveJob).toHaveBeenCalledWith('p1')
    expect(mockStoreRemoveJob).toHaveBeenCalledWith('d1')
  })
})
