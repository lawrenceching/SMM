import { useQuery } from "@tanstack/react-query"
import type { UserConfig } from "@core/types"
import { readUserConfigFromUserDataDir } from "@/api/readUserConfig"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export function useUserConfigQuery(userDataDir: string | undefined) {
  return useQuery<UserConfig>({
    queryKey: userDataDir ? userConfigQueryKey(userDataDir) : ["userConfig", "pending"],
    queryFn: () => readUserConfigFromUserDataDir(userDataDir!),
    enabled: Boolean(userDataDir),
  })
}
