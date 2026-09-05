import { createContext, useContext, type ReactNode } from "react"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface RenameToolbarOption {
  value: "plex" | "emby"
  label: string
}

export interface TvShowAppPlanPromptContextValue {
  aiRenamePlan: UIRenameFilesPlan | undefined
  aiRenamePromptStatus: "generating" | "wait-for-ack"
  aiRecognizePlan: UIRecognizeMediaFilePlan | undefined
  aiRecognizePromptStatus: "generating" | "wait-for-ack"

  onAiRenameConfirm: () => void | Promise<void>
  onAiRenameCancel: () => void | Promise<void>
  onAiRecognizeConfirm: () => void | Promise<void>
  onAiRecognizeCancel: () => void | Promise<void>
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

// eslint-disable-next-line react-refresh/only-export-components
export function useTvShowAppPlanPrompts(): TvShowAppPlanPromptContextValue {
  const ctx = useContext(TvShowAppPlanPromptContext)
  if (!ctx) {
    throw new Error(
      "useTvShowAppPlanPrompts must be used within TvShowAppPlanPromptProvider",
    )
  }
  return ctx
}
