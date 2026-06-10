import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { isFolderAvailable } from "@/api/isFolderAvailable"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import type { HelloResponseBody } from "@core/types"

/** While these are active, availability must not overwrite with `ok` (other flows own the row). */
const skipOkOverlay: ReadonlySet<UIMediaFolderStatus> = new Set([
 "loading",
 "updating",
 "initializing",
 "pending_for_initialization",
])

/**
 * When the user selects a folder in the sidebar, re-check only that path against the server
 * so {@link UIMediaFolder.status} reflects current disk availability.
 */
export function useRecheckSelectedFolderAvailability() {
 const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder)
 const updateFolderStatus = useUIMediaFolderStore((s) => s.updateFolderStatus)
 const queryClient = useQueryClient()

 useEffect(() => {
 if (!selectedFolder) return

 const ac = new AbortController()

 void (async () => {
 const coreRoutesPort = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.coreRoutesPort
 if (coreRoutesPort === undefined) {
 // hello has not loaded yet — bootstrap guarantees it does
 // (AppInitializer → useReloadAppConfig → hello() → setQueryData)
 // before this hook first fires. Bail silently so we don't
 //404 the not-yet-known port.
 return
 }

 try {
 const available = await isFolderAvailable(selectedFolder, coreRoutesPort, ac.signal)
 if (ac.signal.aborted) return

 const folder = useUIMediaFolderStore
 .getState()
 .folders.find((f) => f.path === selectedFolder)
 const current = folder?.status

 if (!available) {
 updateFolderStatus(selectedFolder, "folder_not_found")
 return
 }

 if (current && skipOkOverlay.has(current)) {
 return
 }

 updateFolderStatus(selectedFolder, "ok")
 } catch {
 if (ac.signal.aborted) return
 /* keep previous status on HTTP/network errors */
 }
 })()

 return () => {
 ac.abort()
 }
 }, [selectedFolder, updateFolderStatus, queryClient])
}
