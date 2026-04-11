import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAiRecognizeConfirm, type SetPlanByIdFn } from './handleAiRecognizeConfirm'
import type { PersistUIMediaMetadataFn } from '@/types/persistUIMediaMetadata'
import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { updatePlan } from '@/api/updatePlan'
import { applyRecognizeMediaFilePlan } from '@/components/TvShowPanelUtils'

vi.mock('@/api/updatePlan', () => ({
  updatePlan: vi.fn(),
}))

vi.mock('@/components/TvShowPanelUtils', () => ({
  applyRecognizeMediaFilePlan: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('handleAiRecognizeConfirm', () => {
  const mediaFolderPath = '/media/show'

  const plan: RecognizeMediaFilePlan = {
    id: 'plan-1',
    task: 'recognize-media-file',
    status: 'pending',
    mediaFolderPath,
    files: [
      { path: '/media/show/ep1.mkv', season: 1, episode: 1 },
    ],
  }

  const mediaMetadata: UIMediaMetadata = {
    mediaFolderPath,
    type: 'tvshow-folder',
    status: 'ok',
    files: ['/media/show/ep1.mkv'],
    mediaFiles: [],
  } as UIMediaMetadata

  let persist: ReturnType<typeof vi.fn>
  let setPlanById: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(updatePlan).mockResolvedValue({})
    vi.mocked(applyRecognizeMediaFilePlan).mockResolvedValue(undefined)
    persist = vi.fn().mockResolvedValue(undefined)
    setPlanById = vi.fn()
  })

  it('calls updatePlan with plan id and "completed" on happy path', async () => {
    await handleAiRecognizeConfirm(plan, mediaMetadata, persist as PersistUIMediaMetadataFn, setPlanById as SetPlanByIdFn)

    expect(updatePlan).toHaveBeenCalledTimes(1)
    expect(updatePlan).toHaveBeenCalledWith(plan.id, 'completed')
    expect(applyRecognizeMediaFilePlan).toHaveBeenCalledWith(
      plan,
      mediaMetadata,
      persist,
      expect.objectContaining({ traceId: expect.stringMatching(/^handleAiRecognizeConfirm-/) })
    )
  })
})
