import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TMDBTVShow, TMDBTVShowDetails } from '@core/types'

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

interface UseTmdbidFromFolderNamePromptData {
  isOpen: boolean
  tmdbId: number | undefined
  mediaName: string | undefined
  status: 'ready' | 'loading' | 'error' | undefined
  onConfirm: ((tmdbTvShow: TMDBTVShow) => void) | undefined
  onCancel: (() => void) | undefined
}

interface RuleBasedRenameFilePromptData {
  isOpen: boolean
  toolbarOptions: ToolbarOption[] | undefined
  selectedNamingRule: "plex" | "emby" | undefined
  setSelectedNamingRule: ((rule: "plex" | "emby") => void) | undefined
  onConfirm: (() => void) | undefined
  onCancel: (() => void) | undefined
}

interface AiBasedRenameFilePromptData {
  isOpen: boolean
  status: "generating" | "wait-for-ack" | undefined
  onConfirm: (() => void) | undefined
  onCancel: (() => void) | undefined
}

interface AiBasedRecognizePromptData {
  isOpen: boolean
  status: "generating" | "wait-for-ack" | undefined
  confirmButtonLabel: string | undefined
  confirmButtonDisabled: boolean | undefined
  isRenaming: boolean | undefined
  onConfirm: (() => void) | undefined
  onCancel: (() => void) | undefined
}

interface RuleBasedRecognizePromptData {
  isOpen: boolean
  onConfirm: (() => void) | undefined
  onCancel: (() => void) | undefined
}

interface TvShowPromptsState {
  useNfoPrompt: UseNfoPromptData
  useTmdbidFromFolderNamePrompt: UseTmdbidFromFolderNamePromptData
  ruleBasedRenameFilePrompt: RuleBasedRenameFilePromptData
  aiBasedRenameFilePrompt: AiBasedRenameFilePromptData
  aiBasedRecognizePrompt: AiBasedRecognizePromptData
  ruleBasedRecognizePrompt: RuleBasedRecognizePromptData

  openUseNfoPrompt: (config: {
    nfoData: TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => void

  closeUseNfoPrompt: () => void

  openUseTmdbidFromFolderNamePrompt: (config: {
    tmdbId: number
    mediaName?: string
    status: 'ready' | 'loading' | 'error'
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => void

  updateTmdbidFromFolderNamePromptStatus: (status: 'ready' | 'loading' | 'error', mediaName?: string) => void
  closeUseTmdbidFromFolderNamePrompt: () => void

  openRuleBasedRenameFilePrompt: (config: {
    toolbarOptions: ToolbarOption[]
    selectedNamingRule: "plex" | "emby" | undefined
    setSelectedNamingRule: (rule: "plex" | "emby") => void
    onConfirm?: () => void
    onCancel?: () => void
  }) => void

  closeRuleBasedRenameFilePrompt: () => void

  openAiBasedRenameFilePrompt: (config: {
    status: "generating" | "wait-for-ack"
    onConfirm?: () => void
    onCancel?: () => void
  }) => void

  updateAiBasedRenameFileStatus: (status: "generating" | "wait-for-ack") => void
  closeAiBasedRenameFilePrompt: () => void

  openAiBasedRecognizePrompt: (config: {
    status: "generating" | "wait-for-ack"
    confirmButtonLabel?: string
    confirmButtonDisabled?: boolean
    isRenaming?: boolean
    onConfirm?: () => void
    onCancel?: () => void
  }) => void

  updateAiBasedRecognizePrompt: (updates: {
    status?: "generating" | "wait-for-ack"
    confirmButtonLabel?: string
    confirmButtonDisabled?: boolean
    isRenaming?: boolean
  }) => void

  closeAiBasedRecognizePrompt: () => void

  openRuleBasedRecognizePrompt: (config: {
    onConfirm?: () => void
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

  useTmdbidFromFolderNamePrompt: {
    isOpen: false,
    tmdbId: undefined,
    mediaName: undefined,
    status: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as UseTmdbidFromFolderNamePromptData,

  ruleBasedRenameFilePrompt: {
    isOpen: false,
    toolbarOptions: undefined,
    selectedNamingRule: undefined,
    setSelectedNamingRule: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as RuleBasedRenameFilePromptData,

  aiBasedRenameFilePrompt: {
    isOpen: false,
    status: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as AiBasedRenameFilePromptData,

  aiBasedRecognizePrompt: {
    isOpen: false,
    status: undefined,
    confirmButtonLabel: undefined,
    confirmButtonDisabled: undefined,
    isRenaming: undefined,
    onConfirm: undefined,
    onCancel: undefined,
  } as AiBasedRecognizePromptData,

  ruleBasedRecognizePrompt: {
    isOpen: false,
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

      openUseTmdbidFromFolderNamePrompt: ({ tmdbId, mediaName, status, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          useTmdbidFromFolderNamePrompt: {
            isOpen: true,
            tmdbId,
            mediaName,
            status,
            onConfirm,
            onCancel,
          },
        })
      },

      updateTmdbidFromFolderNamePromptStatus: (status, mediaName) => {
        set((state) => ({
          useTmdbidFromFolderNamePrompt: {
            ...state.useTmdbidFromFolderNamePrompt,
            status,
            mediaName: mediaName !== undefined ? mediaName : state.useTmdbidFromFolderNamePrompt.mediaName,
          },
        }))
      },

      closeUseTmdbidFromFolderNamePrompt: () => {
        set({
          useTmdbidFromFolderNamePrompt: initialState.useTmdbidFromFolderNamePrompt,
        })
      },

      openRuleBasedRenameFilePrompt: ({ toolbarOptions, selectedNamingRule, setSelectedNamingRule, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          ruleBasedRenameFilePrompt: {
            isOpen: true,
            toolbarOptions,
            selectedNamingRule,
            setSelectedNamingRule,
            onConfirm,
            onCancel,
          },
        })
      },

      closeRuleBasedRenameFilePrompt: () => {
        set({
          ruleBasedRenameFilePrompt: initialState.ruleBasedRenameFilePrompt,
        })
      },

      openAiBasedRenameFilePrompt: ({ status, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          aiBasedRenameFilePrompt: {
            isOpen: true,
            status,
            onConfirm,
            onCancel,
          },
        })
      },

      updateAiBasedRenameFileStatus: (status) => {
        set((state) => ({
          aiBasedRenameFilePrompt: {
            ...state.aiBasedRenameFilePrompt,
            status,
          },
        }))
      },

      closeAiBasedRenameFilePrompt: () => {
        set({
          aiBasedRenameFilePrompt: initialState.aiBasedRenameFilePrompt,
        })
      },

      openAiBasedRecognizePrompt: ({ status, confirmButtonLabel, confirmButtonDisabled, isRenaming, onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          aiBasedRecognizePrompt: {
            isOpen: true,
            status,
            confirmButtonLabel,
            confirmButtonDisabled,
            isRenaming,
            onConfirm,
            onCancel,
          },
        })
      },

      updateAiBasedRecognizePrompt: (updates) => {
        set((state) => ({
          aiBasedRecognizePrompt: {
            ...state.aiBasedRecognizePrompt,
            ...updates,
          },
        }))
      },

      closeAiBasedRecognizePrompt: () => {
        set({
          aiBasedRecognizePrompt: initialState.aiBasedRecognizePrompt,
        })
      },

      openRuleBasedRecognizePrompt: ({ onConfirm, onCancel }) => {
        get().closeAllPrompts()
        set({
          ruleBasedRecognizePrompt: {
            isOpen: true,
            onConfirm,
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
export const useUseTmdbidFromFolderNamePrompt = () => useTvShowPromptsStore((state) => state.useTmdbidFromFolderNamePrompt)
export const useRuleBasedRenameFilePrompt = () => useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
export const useAiBasedRenameFilePrompt = () => useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
export const useAiBasedRecognizePrompt = () => useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
export const useRuleBasedRecognizePrompt = () => useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)

export const usePromptsActions = () => useTvShowPromptsStore((state) => ({
  openUseNfoPrompt: state.openUseNfoPrompt,
  closeUseNfoPrompt: state.closeUseNfoPrompt,
  openUseTmdbidFromFolderNamePrompt: state.openUseTmdbidFromFolderNamePrompt,
  updateTmdbidFromFolderNamePromptStatus: state.updateTmdbidFromFolderNamePromptStatus,
  closeUseTmdbidFromFolderNamePrompt: state.closeUseTmdbidFromFolderNamePrompt,
  openRuleBasedRenameFilePrompt: state.openRuleBasedRenameFilePrompt,
  closeRuleBasedRenameFilePrompt: state.closeRuleBasedRenameFilePrompt,
  openAiBasedRenameFilePrompt: state.openAiBasedRenameFilePrompt,
  updateAiBasedRenameFileStatus: state.updateAiBasedRenameFileStatus,
  closeAiBasedRenameFilePrompt: state.closeAiBasedRenameFilePrompt,
  openAiBasedRecognizePrompt: state.openAiBasedRecognizePrompt,
  updateAiBasedRecognizePrompt: state.updateAiBasedRecognizePrompt,
  closeAiBasedRecognizePrompt: state.closeAiBasedRecognizePrompt,
  openRuleBasedRecognizePrompt: state.openRuleBasedRecognizePrompt,
  closeRuleBasedRecognizePrompt: state.closeRuleBasedRecognizePrompt,
  closeAllPrompts: state.closeAllPrompts,
}))

// Unified control hooks for prompts
export const useAiBasedRenameFilePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const updateStatus = useTvShowPromptsStore((state) => state.updateAiBasedRenameFileStatus)
  const open = useTvShowPromptsStore((state) => state.openAiBasedRenameFilePrompt)
  const close = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; status?: "generating" | "wait-for-ack"; onConfirm?: () => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          status: config.status || "generating",
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      } else if (config.status !== undefined) {
        updateStatus(config.status)
      }
    }
  }
}

export const useAiBasedRecognizePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
  const update = useTvShowPromptsStore((state) => state.updateAiBasedRecognizePrompt)
  const open = useTvShowPromptsStore((state) => state.openAiBasedRecognizePrompt)
  const close = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; status?: "generating" | "wait-for-ack"; confirmButtonLabel?: string; confirmButtonDisabled?: boolean; isRenaming?: boolean; onConfirm?: () => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          status: config.status || "generating",
          confirmButtonLabel: config.confirmButtonLabel,
          confirmButtonDisabled: config.confirmButtonDisabled,
          isRenaming: config.isRenaming,
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      } else if (config.status !== undefined || config.confirmButtonLabel !== undefined || config.confirmButtonDisabled !== undefined || config.isRenaming !== undefined) {
        update({
          status: config.status,
          confirmButtonLabel: config.confirmButtonLabel,
          confirmButtonDisabled: config.confirmButtonDisabled,
          isRenaming: config.isRenaming,
        })
      }
    }
  }
}

export const useRuleBasedRenameFilePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
  const open = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const close = useTvShowPromptsStore((state) => state.closeRuleBasedRenameFilePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; toolbarOptions?: ToolbarOption[]; selectedNamingRule?: "plex" | "emby" | undefined; setSelectedNamingRule?: ((rule: "plex" | "emby") => void) | undefined; onConfirm?: () => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          toolbarOptions: config.toolbarOptions || [],
          selectedNamingRule: config.selectedNamingRule,
          setSelectedNamingRule: config.setSelectedNamingRule,
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      }
    }
  }
}

export const useRuleBasedRecognizePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)
  const open = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const close = useTvShowPromptsStore((state) => state.closeRuleBasedRecognizePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; onConfirm?: () => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
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

export const useUseTmdbidFromFolderNamePromptControl = () => {
  const state = useTvShowPromptsStore((state) => state.useTmdbidFromFolderNamePrompt)
  const updateStatus = useTvShowPromptsStore((state) => state.updateTmdbidFromFolderNamePromptStatus)
  const open = useTvShowPromptsStore((state) => state.openUseTmdbidFromFolderNamePrompt)
  const close = useTvShowPromptsStore((state) => state.closeUseTmdbidFromFolderNamePrompt)

  return {
    states: state,
    setState: (config: { open?: boolean; tmdbId?: number; mediaName?: string; status?: 'ready' | 'loading' | 'error'; onConfirm?: (tmdbTvShow: TMDBTVShow) => void; onCancel?: () => void }) => {
      if (config.open === false) {
        close()
      } else if (config.open === true) {
        open({
          tmdbId: config.tmdbId!,
          mediaName: config.mediaName,
          status: config.status || 'ready',
          onConfirm: config.onConfirm,
          onCancel: config.onCancel,
        })
      } else if (config.status !== undefined || config.mediaName !== undefined) {
        updateStatus(config.status, config.mediaName)
      }
    }
  }
}
