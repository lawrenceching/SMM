import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TMDBTVShow, TMDBTVShowDetails } from '@core/types'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'

interface ToolbarOption {
  value: "plex" | "emby"
  label: string
}

interface UseNfoPromptData {
  isOpen: boolean
  data: TMDBTVShowDetails | undefined
  tmdbid: number | undefined
  mediaName: string | undefined
  onConfirm: ((tmdbTvShow: TMDBTVShow) => void) | undefined
  onCancel: (() => void) | undefined
}

interface RuleBasedRenameFilePromptData {
  isOpen: boolean
  toolbarOptions: ToolbarOption[] | undefined
  selectedNamingRule: "plex" | "emby" | undefined
  setSelectedNamingRule: ((rule: "plex" | "emby") => void) | undefined
  planId: string | undefined
  onConfirm: ((planId: string) => void) | undefined
  onCancel: (() => void) | undefined
  onNamingRulesSelected: ((rule: "plex" | "emby") => void) | undefined
}

interface RuleBasedRecognizePromptData {
  isOpen: boolean
  tvShowTitle: string | undefined
  tvShowTmdbId: number | undefined
  planId: string | undefined
  onConfirm: ((plan: UIRecognizeMediaFilePlan) => void) | undefined
  onCancel: (() => void) | undefined
}

interface TvShowPromptsState {
  useNfoPrompt: UseNfoPromptData
  ruleBasedRenameFilePrompt: RuleBasedRenameFilePromptData
  ruleBasedRecognizePrompt: RuleBasedRecognizePromptData

  openUseNfoPrompt: (config: {
    nfoData: TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => void

  closeUseNfoPrompt: () => void

  openRuleBasedRenameFilePrompt: (config: {
    toolbarOptions: ToolbarOption[]
    selectedNamingRule: "plex" | "emby" | undefined
    setSelectedNamingRule: (rule: "plex" | "emby") => void
    planId: string
    onConfirm?: (planId: string) => void
    onCancel?: () => void
    onNamingRulesSelected?: (rule: "plex" | "emby") => void
  }) => void

  updateRuleBasedRenameFilePromptSelectedRule: (rule: "plex" | "emby") => void
  closeRuleBasedRenameFilePrompt: () => void

  openRuleBasedRecognizePrompt: (config: {
    tvShowTitle: string
    tvShowTmdbId: number
    planId?: string
    onConfirm?: (plan: UIRecognizeMediaFilePlan) => void
    onCancel?: () => void
  }) => void

  closeRuleBasedRecognizePrompt: () => void

  closeAllPrompts: () => void
}

const initialState = {
  useNfoPrompt: {
    isOpen: false,
    data: undefined,
    tmdbid: undefined,
    mediaName: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as UseNfoPromptData,

  ruleBasedRenameFilePrompt: {
    isOpen: false,
    toolbarOptions: undefined,
    selectedNamingRule: undefined,
    setSelectedNamingRule: undefined,
    onConfirm: undefined,
    onCancel: undefined,
    onNamingRulesSelected: undefined,
  } as RuleBasedRenameFilePromptData,

  ruleBasedRecognizePrompt: {
    isOpen: false,
    tvShowTitle: undefined,
    tvShowTmdbId: undefined,
    planId: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as RuleBasedRecognizePromptData,
}

export const useTvShowPromptsStore = create<TvShowPromptsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      openUseNfoPrompt: ({ nfoData, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          useNfoPrompt: {
            isOpen: true,
            data: nfoData,
            tmdbid: nfoData.id,
            mediaName: nfoData.name,
            onConfirm,
            onCancel,
          },
        })
      },

      closeUseNfoPrompt: () => {
        set({
          useNfoPrompt: initialState.useNfoPrompt,
        })
      },

      openRuleBasedRenameFilePrompt: ({ toolbarOptions, selectedNamingRule, setSelectedNamingRule, planId, onConfirm, onCancel, onNamingRulesSelected }) => {
        get().closeAllPrompts()
        set({
          ruleBasedRenameFilePrompt: {
            isOpen: true,
            toolbarOptions,
            selectedNamingRule,
            setSelectedNamingRule,
            planId,
            onConfirm,
            onCancel,
            onNamingRulesSelected,
          },
        })
      },

      closeRuleBasedRenameFilePrompt: () => {
        set({
          ruleBasedRenameFilePrompt: initialState.ruleBasedRenameFilePrompt,
        })
      },

      updateRuleBasedRenameFilePromptSelectedRule: (rule: "plex" | "emby") => {
        set((state) => ({
          ruleBasedRenameFilePrompt: {
            ...state.ruleBasedRenameFilePrompt,
            selectedNamingRule: rule,
          },
        }))
      },

      openRuleBasedRecognizePrompt: ({ tvShowTitle, tvShowTmdbId, planId, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          ruleBasedRecognizePrompt: {
            isOpen: true,
            tvShowTitle,
            tvShowTmdbId,
            planId,
            onConfirm: onConfirm ? (plan) => onConfirm(plan) : undefined,
            onCancel,
          },
        })
      },

      closeRuleBasedRecognizePrompt: () => {
        set({
          ruleBasedRecognizePrompt: initialState.ruleBasedRecognizePrompt,
        })
      },

      closeAllPrompts: () => {
        set(initialState)
      },
    }),
    { name: 'TvShowPromptsStore' }
  )
)

export const useUseNfoPrompt = () => useTvShowPromptsStore((state) => state.useNfoPrompt)
export const useRuleBasedRenameFilePrompt = () => useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
export const useRuleBasedRecognizePrompt = () => useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)

// Unified control hooks for prompts (legacy callers)
export const useRuleBasedRenameFilePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
  const open = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const close = useTvShowPromptsStore((state) => state.closeRuleBasedRenameFilePrompt)
  const updateSelectedRule = useTvShowPromptsStore((state) => state.updateRuleBasedRenameFilePromptSelectedRule)

  return {
    states: state,
    setState: (config: { open?: boolean; planId?: string; toolbarOptions?: ToolbarOption[]; selectedNamingRule?: "plex" | "emby" | undefined; setSelectedNamingRule?: ((rule: "plex" | "emby") => void) | undefined; onConfirm?: (planId: string) => void; onCancel?: () => void; onNamingRulesSelected?: (rule: "plex" | "emby") => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          toolbarOptions: config.toolbarOptions || [],
          selectedNamingRule: config.selectedNamingRule,
          setSelectedNamingRule: config.setSelectedNamingRule || (() => {}),
          planId: config.planId ?? '',
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
          onNamingRulesSelected: config.onNamingRulesSelected,
        })
      }
    },
    updateSelectedRule,
  }
}

export const useRuleBasedRecognizePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)
  const open = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const close = useTvShowPromptsStore((state) => state.closeRuleBasedRecognizePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; tvShowTitle?: string; tvShowTmdbId?: number; onConfirm?: () => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          tvShowTitle: config.tvShowTitle!,
          tvShowTmdbId: config.tvShowTmdbId!,
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      }
    }
  }
}

export const useUseNfoPromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.useNfoPrompt)
  const open = useTvShowPromptsStore((state) => state.openUseNfoPrompt)
  const close = useTvShowPromptsStore((state) => state.closeUseNfoPrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; nfoData?: TMDBTVShowDetails; onConfirm?: (tmdbTvShow: TMDBTVShow) => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          nfoData: config.nfoData!,
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      }
    }
  }
}
