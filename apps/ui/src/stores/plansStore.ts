import { create } from 'zustand'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'
import type { UIRenameFilesPlan } from '@/types/UIRenameFilesPlan'


export type UIPlan = UIRecognizeMediaFilePlan | UIRenameFilesPlan

interface PlansState {
  /**
   * Stores plans from 2 sources:
   * 1. persisted plan from backend
   * 2. temporary plan from user-triggered recognize/rename
   */
  plans: UIPlan[]
  setPlans: (plans: UIPlan[] | ((prev: UIPlan[]) => UIPlan[])) => void
  setPlanById: (id: string, payload: Partial<UIPlan>) => void
  getPlanById: (id: string) => UIPlan | undefined
}

export const usePlansStore = create<PlansState>((set, get) => ({

  plans: [],
  setPlans: (plans: UIPlan[] | ((prev: UIPlan[]) => UIPlan[])) => {
    const newPlans = typeof plans === 'function' ? plans(get().plans) : plans
    set({ plans: newPlans })
  },
  setPlanById: (id: string, payload: Partial<UIPlan>) => {
    set(state => ({
      plans: state.plans.map(plan =>
        plan.id === id ? { ...plan, ...payload } as UIPlan : plan
      ),
    }))
  },
  getPlanById: (id: string) => {
    const { plans } = get()
    return plans.find(plan => plan.id === id)
  }
}))
