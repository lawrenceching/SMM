import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from "zod"
import { useEffect } from "react"
import { resolveAppLanguage } from "@core/locale"
import type { LanguageCode } from "@core/types"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useConfig } from "@/hooks/userConfig/useConfig"
import { useHelloQuery } from "@/hooks/userConfig/useHelloQuery"
import { useAiContextStore } from "@/ai/aiContextStore"
import {
  GET_APPLICATION_CONTEXT,
  GET_APPLICATION_CONTEXT_DESCRIPTION,
  type GetApplicationContextOutput,
} from "@core/types/ai-tools/getApplicationContext"

export type ApplicationContextData = GetApplicationContextOutput

const getApplicationContextTool = tool({
  description: GET_APPLICATION_CONTEXT_DESCRIPTION,
  parameters: z.object({}),
  execute: async (): Promise<ApplicationContextData> => {
    // Read from the dedicated AI context store. Unlike the previous
    // module-level `configCache` pattern, the store is updated
    // synchronously inside the same effect that reads the data, so
    // `getState()` never returns a stale partial view. The store
    // also subscribes to `useUIMediaFolderStore` (via the React
    // component below) so the selected folder stays fresh.
    const snapshot = useAiContextStore.getState()

    const language = resolveAppLanguage({
      configured: snapshot.applicationLanguage,
      osLocale: snapshot.osLocale,
    })

    return {
      selectedMediaFolder: snapshot.selectedMediaFolder,
      language,
    }
  },
})

const _GetApplicationContextTool = makeAssistantTool({
  ...getApplicationContextTool,
  toolName: GET_APPLICATION_CONTEXT,
})

/**
 * Client-side AI tool that returns the currently selected media folder
 * path and the user's resolved application language.
 *
 * The tool `execute` runs outside the React tree, so it reads
 * synchronously from `useAiContextStore`. This component subscribes
 * to the upstream React state (`useUIMediaFolderStore`,
 * `useConfig`, `useHelloQuery`) and mirrors it into the AI context
 * store via `setSnapshot()` — a single `set()` call keeps all
 * three fields coherent.
 */
export function GetApplicationContextTool() {
  const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder)
  const { userConfig } = useConfig()
  const { data: helloData } = useHelloQuery()

  useEffect(() => {
    useAiContextStore.getState().setSnapshot({
      selectedMediaFolder: selectedFolder ?? "",
      applicationLanguage: userConfig.applicationLanguage as
        | LanguageCode
        | undefined,
      osLocale: helloData?.osLocale ?? "",
    })
  }, [selectedFolder, userConfig.applicationLanguage, helloData?.osLocale])

  return <_GetApplicationContextTool />
}
