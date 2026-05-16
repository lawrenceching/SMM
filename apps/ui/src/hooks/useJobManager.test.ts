import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJobManager } from './useJobManager'
import type { BackgroundJob } from '@/types/background-jobs'

const mockAbortJob = vi.fn()
const mockOrchestratorStopJob = vi.fn()
const mockRefreshFromIndexedDB = vi.fn().mockResolvedValue(undefined)

vi.mock('@/components/JobOrchestratorProvider', () => ({
  useJobOrchestratorContext: vi.fn(),
}))

const mockGetState = vi.fn()

vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: Object.assign(vi.fn(), {
    getState: () => mockGetState(),
  }),
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
    }
    return typeof selector === 'function' ? selector(state) : state
  })
  mockGetState.mockReturnValue({
    jobs,
    abortJob: mockAbortJob,
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
      removeJob: vi.fn(),
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
})
