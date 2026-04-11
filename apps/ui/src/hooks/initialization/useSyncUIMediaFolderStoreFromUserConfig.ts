import { useEffect } from "react"
import { useConfig } from "@/hooks/userConfig"
import { uiMediaFoldersFromPaths, useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"

/**
 * Keeps {@link uiMediaFoldersFromPaths} rows in sync with persisted `UserConfig.folders`.
 */
export function useSyncUIMediaFolderStoreFromUserConfig() {
  const { userConfig } = useConfig()
  const setFolders = useUIMediaFolderStore((s) => s.setFolders)

  useEffect(() => {
    setFolders(uiMediaFoldersFromPaths(userConfig.folders))
  }, [setFolders, userConfig.folders])
}
