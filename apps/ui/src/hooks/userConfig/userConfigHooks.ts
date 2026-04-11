import { useConfig } from "./useConfig"

/** Subscribe to persisted user settings (`smm.json`) via TanStack Query cache. */
export function useUserConfig() {
  const { userConfig, isLoading, error } = useConfig()
  return {
    data: userConfig,
    isLoading,
    isPending: isLoading,
    error,
  }
}

export { useAddMediaFolderMutation } from "./useAddMediaFolderMutation"
export { useSaveUserConfigMutation } from "./useSaveUserConfigMutation"
