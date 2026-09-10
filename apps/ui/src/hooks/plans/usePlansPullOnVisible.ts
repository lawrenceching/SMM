import { useEffect } from "react"
import { queryClient } from "@/lib/queryClient"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { PLANS_QUERY_ROOT } from "./plansQueryKeys"

/**
 * Browser-side pulling: a backgrounded browser may pause its JS and
 * miss server-pushed events, so refetch pending plans when the
 * browser becomes visible and a media folder is already selected.
 */
export function usePlansPullOnVisible() {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (!useUIMediaFolderStore.getState().selectedFolder) return
      void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])
}
