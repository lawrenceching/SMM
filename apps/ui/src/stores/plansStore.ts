import { create } from 'zustand'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import type { RecognizeMediaFilePlan, RecognizedFile } from '@core/types/RecognizeMediaFilePlan'
import type { UpdatePlanStatus } from '@/api/updatePlan'
import { getPendingPlans } from '@/api/getPendingPlans'
import { updatePlan as updatePlanApi } from '@/api/updatePlan'

interface PlansState {
  pendingPlans: UIRecognizeMediaFilePlan[]
  pendingRenamePlans: RenameFilesPlan[]
  loading: boolean
  fetchPendingPlans: () => Promise<void>
  updatePlan: (planId: string, status: UpdatePlanStatus) => Promise<void>
  addTmpPlan: (plan: Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] }) => void
}

export const usePlansStore = create<PlansState>((set, get) => ({
  pendingPlans: [],
  pendingRenamePlans: [],
  loading: false,

  fetchPendingPlans: async () => {
    set({ loading: true })
    try {
      const response = await getPendingPlans()
      if (response.error) {
        console.error('[usePlansStore] Error fetching pending plans:', response.error)
        set({ pendingPlans: [], pendingRenamePlans: [], loading: false })
      } else {
        set({
          pendingPlans: response.data?.map(plan => ({ ...plan, tmp: false })) as UIRecognizeMediaFilePlan[] ?? [],
          pendingRenamePlans: response.renamePlans ?? [],
          loading: false,
        })
      }
    } catch (error) {
      console.error('[usePlansStore] Failed to fetch pending plans:', error)
      set({ pendingPlans: [], pendingRenamePlans: [], loading: false })
    }
  },

  updatePlan: async (planId: string, status: UpdatePlanStatus) => {
    const { pendingPlans } = get()
    const plan = pendingPlans.find(p => p.id === planId)
    const isTmpPlan = plan?.tmp === true

    set(state => ({
      pendingPlans: state.pendingPlans.filter(p => p.id !== planId),
      pendingRenamePlans: state.pendingRenamePlans.filter(p => p.id !== planId),
    }))

    if (isTmpPlan) {
      console.log('[usePlansStore] Temporary plan removed from state (no API call)', { planId })
      return
    }

    try {
      const result = await updatePlanApi(planId, status)
      if (result.error) {
        console.error('[usePlansStore] Failed to update plan:', result.error)
        await get().fetchPendingPlans()
        throw new Error(result.error)
      } else {
        console.log('[usePlansStore] Plan updated successfully', { planId, status })
      }
    } catch (error) {
      console.error('[usePlansStore] Error updating plan:', error)
      await get().fetchPendingPlans()
      throw error
    }
  },

  addTmpPlan: (plan: Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] }) => {
    const tmpPlan: UIRecognizeMediaFilePlan = {
      ...plan,
      id: plan.id || crypto.randomUUID(),
      tmp: true,
      task: 'recognize-media-file',
      status: 'pending',
    } as UIRecognizeMediaFilePlan
    set(state => ({ pendingPlans: [...state.pendingPlans, tmpPlan] }))
    console.log('[usePlansStore] Temporary plan added to state', { planId: tmpPlan.id, mediaFolderPath: tmpPlan.mediaFolderPath })
  },
}))
