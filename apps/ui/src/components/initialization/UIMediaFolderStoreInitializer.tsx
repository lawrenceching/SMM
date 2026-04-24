import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useEffect, useRef } from "react"
import { Path } from "@core/path"
import localStorages from "@/lib/localStorages"

export function UIMediaFolderStoreInitializer() {
  
  const { userConfig, isLoading, isUserConfigLoaded } = useConfig()
  const setFolders = useUIMediaFolderStore((s) => s.setFolders)
  const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder)
  const initializedRef = useRef(false)

  useEffect(() => {

    if (isLoading || !isUserConfigLoaded) {
      return
    }

    if(initializedRef.current) {
      return
    }
    
    setFolders(userConfig.folders.map(folder => {
      return {
        path: folder,
        status: "ok",
        test: false,
      }
    }))

    const persistedSelectedFolder = localStorages.sidebarSelectedFolder
    const restoredSelection = persistedSelectedFolder
      ? userConfig.folders.find((folder) => Path.posix(folder) === Path.posix(persistedSelectedFolder))
      : undefined
    const fallbackSelection = restoredSelection ?? userConfig.folders[0] ?? ""
    setSelectedFolder(fallbackSelection)
    initializedRef.current = true
  }, [
    setFolders,
    setSelectedFolder,
    userConfig.folders,
    isLoading,
    initializedRef,
    isUserConfigLoaded,
  ])

  
  return null
}
