import { isFolderAvailable } from "@/api/isFolderAvailable"
import { useRecheckSelectedFolderAvailability } from "@/hooks/initialization/useRecheckSelectedFolderAvailability"
import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useEffect, useRef } from "react"
import { Path } from "@core/path"
import localStorages from "@/lib/localStorages"

export function UIMediaFolderStoreInitializer() {
 useRecheckSelectedFolderAvailability()

 const { userConfig, isLoading, isUserConfigLoaded } = useConfig()
 const setFolders = useUIMediaFolderStore((s) => s.setFolders)
 const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder)
 const updateFolderStatus = useUIMediaFolderStore((s) => s.updateFolderStatus)
 const initializedRef = useRef(false)

 useEffect(() => {
 if (isLoading || !isUserConfigLoaded) {
 return
 }

 if (initializedRef.current) {
 return
 }

 const folders = userConfig.folders.map((folder) => ({
 path: Path.toPlatformPath(folder),
 status: "ok" as const,
 test: false,
 }))
 setFolders(folders)

 const persistedSelectedFolder = localStorages.sidebarSelectedFolder
 const restoredSelection = persistedSelectedFolder
 ? userConfig.folders.find((folder) => Path.posix(folder) === Path.posix(persistedSelectedFolder))
 : undefined
 const rawFallback = restoredSelection ?? userConfig.folders[0] ?? ""
 const fallbackSelection = rawFallback ? Path.toPlatformPath(rawFallback) : ""
 setSelectedFolder(fallbackSelection)
 initializedRef.current = true

 void (async () => {
 for (const row of folders) {
 try {
 const available = await isFolderAvailable(row.path)
 if (!available) {
 updateFolderStatus(row.path, "folder_not_found")
 }
 } catch {
 /* keep ok — network/server errors should not blank the UI */
 }
 }
 })()
 }, [
 setFolders,
 setSelectedFolder,
 updateFolderStatus,
 userConfig.folders,
 isLoading,
 isUserConfigLoaded,
])

 return null
}
