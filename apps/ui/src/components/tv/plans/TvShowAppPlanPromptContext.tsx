import { createContext, useContext, type ReactNode } from "react"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface RenameToolbarOption {
  value: "plex" | "emby"
  label: string
}

export interface TvShowAppPlanPromptContextValue {
  appRenamePlan: UIRenameFilesPlan | undefined
  appRecognizePlan: UIRecognizeMediaFilePlan | undefined
  aiRenamePlan: UIRenameFilesPlan | undefined
  aiRenamePromptStatus: "generating" | "wait-for-ack"
  aiRecognizePlan: UIRecognizeMediaFilePlan | undefined
  aiRecognizePromptStatus: "generating" | "wait-for-ack"

  renameToolbarOptions: RenameToolbarOption[]
  selectedNamingRule: "plex" | "emby"
  setSelectedNamingRule: (rule: "plex" | "emby") => void

  onAppRenameNamingRuleSelected: (rule: "plex" | "emby") => void | Promise<void>
  onAppRenameConfirm: (planId: string) => void | Promise<void>
  onAppRenameCancel: (planId: string) => void | Promise<void>
  onAiRenameConfirm: () => void | Promise<void>
  onAiRenameCancel: () => void | Promise<void>
  onAiRecognizeConfirm: () => void | Promise<void>
  onAiRecognizeCancel: () => void | Promise<void>

  onAppRecognizeConfirm: (plan: UIRecognizeMediaFilePlan) => void | Promise<void>
  onAppRecognizeCancel: (planId: string) => void | Promise<void>

  tvShowTitle: string
  tvShowTmdbId: number
  isRuleBasedRecognizeLoading: boolean
  notAllEpisodesRecognized: boolean
  allPlanFilesUnchanged: boolean
}

const TvShowAppPlanPromptContext = createContext<TvShowAppPlanPromptContextValue | null>(
  null,
)

export function TvShowAppPlanPromptProvider({
  value,
  children,
}: {
  value: TvShowAppPlanPromptContextValue
  children: ReactNode
}) {
  return (
    <TvShowAppPlanPromptContext.Provider value={value}>
      {children}
    </TvShowAppPlanPromptContext.Provider>
  )
}

export function useTvShowAppPlanPrompts(): TvShowAppPlanPromptContextValue {
  const ctx = useContext(TvShowAppPlanPromptContext)
  if (!ctx) {
    throw new Error(
      "useTvShowAppPlanPrompts must be used within TvShowAppPlanPromptProvider",
    )
  }
  return ctx
}
