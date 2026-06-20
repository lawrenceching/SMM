import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAiRecognizeConfirm, type SetPlanByIdFn } from './handleAiRecognizeConfirm'
import type { PersistUIMediaMetadataFn } from '@/types/persistUIMediaMetadata'
import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { applyRecognizeMediaFilePlan } from '@/components/TvShowPanelUtils'

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
    creator: 'ai',
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
    vi.mocked(applyRecognizeMediaFilePlan).mockResolvedValue(undefined)
    persist = vi.fn().mockResolvedValue(undefined)
    setPlanById = vi.fn().mockResolvedValue(undefined)
  })

  it('applies the plan then persists a "completed" status via setPlanById', async () => {
    await handleAiRecognizeConfirm(plan, mediaMetadata, persist as PersistUIMediaMetadataFn, setPlanById as SetPlanByIdFn)

    expect(applyRecognizeMediaFilePlan).toHaveBeenCalledWith(
      plan,
      mediaMetadata,
      persist,
      expect.objectContaining({ traceId: expect.stringMatching(/^handleAiRecognizeConfirm-/) })
    )
    expect(setPlanById).toHaveBeenCalledTimes(1)
    expect(setPlanById).toHaveBeenCalledWith(plan.id, { status: 'completed' })
  })
})
