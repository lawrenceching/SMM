import { useSyncUIMediaFolderStoreFromUserConfig } from "@/hooks/initialization/useSyncUIMediaFolderStoreFromUserConfig"

export function UIMediaFolderStoreInitializer() {
  useSyncUIMediaFolderStoreFromUserConfig()
  return null
}
