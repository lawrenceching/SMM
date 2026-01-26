import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import type { RecognizeMediaFilePlan, RecognizedFile } from "@core/types/RecognizeMediaFilePlan"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { getPendingPlans } from "@/api/getPendingPlans"
import { updatePlan as updatePlanApi, type UpdatePlanStatus } from "@/api/updatePlan"
import { toast } from "sonner"

export interface MediaFolderState {
  loading: boolean
}

interface GlobalStatesContextValue {
  /**
   * A record from media folder path in POSIX format to media folder state
   */
  mediaFolderStates: Record<string, MediaFolderState>
  setMediaFolderStates: React.Dispatch<React.SetStateAction<Record<string, MediaFolderState>>>
  /**
   * Array of pending recognition plans
   */
  pendingPlans: UIRecognizeMediaFilePlan[]
  /**
   * Array of pending rename plans (V2)
   */
  pendingRenamePlans: RenameFilesPlan[]
  /**
   * Fetch pending plans from the server (recognition and rename)
   */
  fetchPendingPlans: () => Promise<void>
  /**
   * Update a plan's status (reject or complete). Removes the plan from
   * pendingPlans or pendingRenamePlans by planId.
   */
  updatePlan: (planId: string, status: UpdatePlanStatus) => Promise<void>
  /**
   * Add a temporary recognition plan to global state.
   * Temporary plans have tmp: true and are not persisted to backend.
   * Accepts a partial plan - id, tmp, task, and status will be set automatically.
   */
  addTmpPlan: (plan: Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] }) => void
}

const GlobalStatesContext = createContext<GlobalStatesContextValue | undefined>(undefined)

interface GlobalStatesProviderProps {
  children: ReactNode
}

export function GlobalStatesProvider({ children }: GlobalStatesProviderProps) {
  const [mediaFolderStates, setMediaFolderStates] = useState<Record<string, MediaFolderState>>({})
  const [pendingPlans, setPendingPlans] = useState<UIRecognizeMediaFilePlan[]>([])
  const [pendingRenamePlans, setPendingRenamePlans] = useState<RenameFilesPlan[]>([])

  const fetchPendingPlans = useCallback(async () => {
    try {
      const response = await getPendingPlans()
      if (response.error) {
        console.error('[GlobalStatesProvider] Error fetching pending plans:', response.error)
        setPendingPlans([])
        setPendingRenamePlans([])
      } else {
        setPendingPlans(response.data?.map(plan => ({ ...plan, tmp: false })) as UIRecognizeMediaFilePlan[] ?? [])
        setPendingRenamePlans(response.renamePlans ?? [])
      }
    } catch (error) {
      console.error('[GlobalStatesProvider] Failed to fetch pending plans:', error)
      setPendingPlans([])
      setPendingRenamePlans([])
    }
  }, [])

  const updatePlan = useCallback(async (planId: string, status: UpdatePlanStatus) => {
    // Find the plan to check if it's temporary
    const plan = pendingPlans.find(p => p.id === planId)
    const isTmpPlan = plan?.tmp === true

    // Remove from local state
    setPendingPlans(prev => prev.filter(p => p.id !== planId))
    setPendingRenamePlans(prev => prev.filter(p => p.id !== planId))

    // Temporary plans don't need backend API call
    if (isTmpPlan) {
      console.log('[GlobalStatesProvider] Temporary plan removed from state (no API call)', { planId })
      return
    }

    // Persistent plans call backend API
    try {
      const result = await updatePlanApi(planId, status)
      if (result.error) {
        console.error('[GlobalStatesProvider] Failed to update plan:', result.error)
        toast.error(result.error)
        await fetchPendingPlans()
        throw new Error(result.error)
      } else {
        console.log('[GlobalStatesProvider] Plan updated successfully', { planId, status })
      }
    } catch (error) {
      console.error('[GlobalStatesProvider] Error updating plan:', error)
      await fetchPendingPlans()
      if (error instanceof Error && !error.message.includes('Failed to update plan')) {
        toast.error(error.message)
      }
      throw error
    }
  }, [fetchPendingPlans, pendingPlans])

  /**
   * Add a temporary recognition plan to global state.
   * Temporary plans are created by the frontend for rule-based recognition
   * and are not persisted to the backend. They have tmp: true.
   *
   * @param plan - The plan to add (can be RecognizeMediaFilePlan or partial plan).
   *               The tmp flag, id, task, and status will be set automatically.
   */
  const addTmpPlan = useCallback((plan: Partial<RecognizeMediaFilePlan> & { mediaFolderPath: string; files: RecognizedFile[] }) => {
    const tmpPlan: UIRecognizeMediaFilePlan = {
      ...plan,
      id: plan.id || crypto.randomUUID(),
      tmp: true, // Ensure tmp flag is set to true
      task: "recognize-media-file",
      status: "pending",
    } as UIRecognizeMediaFilePlan
    setPendingPlans(prev => [...prev, tmpPlan])
    console.log('[GlobalStatesProvider] Temporary plan added to state', { planId: tmpPlan.id, mediaFolderPath: tmpPlan.mediaFolderPath })
  }, [])

  useEffect(() => {
    fetchPendingPlans()
  }, [fetchPendingPlans])

  const value: GlobalStatesContextValue = {
    mediaFolderStates,
    setMediaFolderStates,
    pendingPlans,
    pendingRenamePlans,
    fetchPendingPlans,
    updatePlan,
    addTmpPlan,
  }

  return (
    <GlobalStatesContext.Provider value={value}>
      {children}
    </GlobalStatesContext.Provider>
  )
}

export function useGlobalStates(): GlobalStatesContextValue {
  const context = useContext(GlobalStatesContext)
  if (context === undefined) {
    throw new Error("useGlobalStates must be used within a GlobalStatesProvider")
  }
  return context
}
