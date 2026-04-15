import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useEffect, useRef } from "react"

export function UIMediaFolderStoreInitializer() {
  
  const { userConfig, isLoading, isUserConfigLoaded } = useConfig()
  const setFolders = useUIMediaFolderStore((s) => s.setFolders)
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
    initializedRef.current = true
  }, [setFolders, userConfig.folders, isLoading, initializedRef, isUserConfigLoaded])

  
  return null
}
