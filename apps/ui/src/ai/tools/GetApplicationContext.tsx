import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from "zod"
import { useEffect } from "react"
import { resolveAppLanguage } from "@core/locale"
import type { LanguageCode } from "@core/types"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useConfig } from "@/hooks/userConfig/useConfig"
import { useHelloQuery } from "@/hooks/userConfig/useHelloQuery"

export interface ApplicationContextData {
  /** The path of the media folder that user selected in UI. */
  selectedMediaFolder: string
  /** The resolved language in user preferences (after fallback chain). */
  language: string
}

/**
 * Module-level cache so the `execute` function (captured by
 * `makeAssistantTool` via spread) can read the latest values without
 * re-creating the tool on every render. Same pattern as
 * `ListFilesInMediaFolder.tsx` and `GetMediaMetadata.tsx`.
 */
let selectedFolderCached = ""
let applicationLanguageCached: LanguageCode | undefined = undefined
let osLocaleCached = ""

const getApplicationContextTool = tool({
  description:
    "Get SMM context:\n  * The media folder user selected/focused on SMM UI\n  * The language in user preferences",
  parameters: z.object({}),
  execute: async (args): Promise<ApplicationContextData> => {
    console.log(
      "[getApplicationContextTool] execute() called",
      { args, timestamp: new Date().toISOString() },
    )
    console.log("[getApplicationContextTool] input parameters", {
      args,
      schema: "z.object({})",
      note: "tool takes no input; LLM is expected to call with {}",
    })

    const result: ApplicationContextData = {
      selectedMediaFolder: selectedFolderCached,
      language: resolveAppLanguage({
        configured: applicationLanguageCached,
        osLocale: osLocaleCached,
      }),
    }

    console.log("[getApplicationContextTool] cache snapshot at execute time", {
      selectedFolderCached,
      applicationLanguageCached,
      osLocaleCached,
    })
    console.log("[getApplicationContextTool] output result", result)

    return result
  },
})

const _GetApplicationContextTool = makeAssistantTool({
  ...getApplicationContextTool,
  toolName: "get-app-context",
})

/**
 * Client-side AI tool that returns the currently selected media folder
 * path and the user's resolved application language.
 *
 * Reads from the renderer-side stores directly:
 * - `useUIMediaFolderStore.selectedFolder` (Zustand)
 * - `useConfig().userConfig.applicationLanguage` (TanStack Query)
 * - `useHelloQuery().osLocale` (TanStack Query, from `HelloResponseBody`)
 *
 * Replaces the server-side `agentTools.getApplicationContext` (which
 * used Socket.IO + Bun.file) for the in-process AI Assistant on
 * HarmonyOS. The server-side implementation is kept intact for the
 * desktop chat pipeline (where `AssistantChatTransport` +
 * `agentTools.getApplicationContext(clientId)` continues to win by
 * key precedence) and for the MCP + debug API + e2e consumers.
 */
export function GetApplicationContextTool() {
  const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder)
  const { userConfig } = useConfig()
  const { data: helloData } = useHelloQuery()

  useEffect(() => {
    const prev = selectedFolderCached
    selectedFolderCached = selectedFolder ?? ""
    if (prev !== selectedFolderCached) {
      console.log("[getApplicationContextTool] selectedFolder cache updated", {
        from: prev,
        to: selectedFolderCached,
      })
    }
  }, [selectedFolder])

  useEffect(() => {
    const prev = applicationLanguageCached
    applicationLanguageCached = userConfig.applicationLanguage
    if (prev !== applicationLanguageCached) {
      console.log("[getApplicationContextTool] applicationLanguage cache updated", {
        from: prev,
        to: applicationLanguageCached,
      })
    }
  }, [userConfig.applicationLanguage])

  useEffect(() => {
    const prev = osLocaleCached
    osLocaleCached = helloData?.osLocale ?? ""
    if (prev !== osLocaleCached) {
      console.log("[getApplicationContextTool] osLocale cache updated", {
        from: prev,
        to: osLocaleCached,
      })
    }
  }, [helloData?.osLocale])

  return <_GetApplicationContextTool />
}