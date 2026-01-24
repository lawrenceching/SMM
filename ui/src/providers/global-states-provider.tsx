import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import { getPendingPlans } from "@/api/getPendingPlans"
import { rejectPlan as rejectPlanApi } from "@/api/rejectPlan"
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
  pendingPlans: RecognizeMediaFilePlan[]
  /**
   * Fetch pending plans from the server
   */
  fetchPendingPlans: () => Promise<void>
  /**
   * Reject a plan and update the cached state
   */
  rejectPlan: (planId: string) => Promise<void>
}

const GlobalStatesContext = createContext<GlobalStatesContextValue | undefined>(undefined)

interface GlobalStatesProviderProps {
  children: ReactNode
}

export function GlobalStatesProvider({ children }: GlobalStatesProviderProps) {
  const [mediaFolderStates, setMediaFolderStates] = useState<Record<string, MediaFolderState>>({})
  const [pendingPlans, setPendingPlans] = useState<RecognizeMediaFilePlan[]>([])

  const fetchPendingPlans = useCallback(async () => {
    try {
      const response = await getPendingPlans()
      if (response.error) {
        console.error('[GlobalStatesProvider] Error fetching pending plans:', response.error)
        setPendingPlans([])
      } else {
        setPendingPlans(response.data || [])
      }
    } catch (error) {
      console.error('[GlobalStatesProvider] Failed to fetch pending plans:', error)
      setPendingPlans([])
    }
  }, [])

  const rejectPlan = useCallback(async (planId: string) => {
    try {
      const result = await rejectPlanApi(planId)
      if (result.error) {
        console.error('[GlobalStatesProvider] Failed to reject plan:', result.error)
        toast.error(result.error)
        throw new Error(result.error)
      } else {
        // Update the cached state by removing the rejected plan
        setPendingPlans(prev => prev.filter(plan => plan.id !== planId))
        console.log('[GlobalStatesProvider] Plan rejected successfully and state updated')
      }
    } catch (error) {
      console.error('[GlobalStatesProvider] Error rejecting plan:', error)
      if (error instanceof Error && !error.message.includes('Failed to reject plan')) {
        toast.error(error.message)
      }
      throw error
    }
  }, [])

  useEffect(() => {
    fetchPendingPlans()
  }, [fetchPendingPlans])

  const value: GlobalStatesContextValue = {
    mediaFolderStates,
    setMediaFolderStates,
    pendingPlans,
    fetchPendingPlans,
    rejectPlan,
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
