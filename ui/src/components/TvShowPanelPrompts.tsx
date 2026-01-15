import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react"
import { UseNfoPrompt } from "./UseNfoPrompt"
import { UseTmdbidFromFolderNamePrompt } from "./UseTmdbidFromFolderNamePrompt"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import type { TMDBTVShow, TMDBTVShowDetails } from "@core/types"

interface ToolbarOption {
  value: "plex" | "emby"
  label: string
}

// Context for prompt state management
interface PromptsContextValue {
  // UseNfoPrompt state
  isUseNfoPromptOpen: boolean
  loadedNfoData: TMDBTVShowDetails | undefined
  setLoadedNfoData: (data: TMDBTVShowDetails | undefined) => void
  onUseNfoConfirm: ((tmdbTvShow: TMDBTVShow) => void) | undefined
  onUseNfoCancel: (() => void) | undefined
  _setOnUseNfoConfirm: (callback: ((tmdbTvShow: TMDBTVShow) => void) | undefined) => void
  _setOnUseNfoCancel: (callback: (() => void) | undefined) => void
  
  // UseTmdbidFromFolderNamePrompt state
  isUseTmdbidFromFolderNamePromptOpen: boolean
  tmdbIdFromFolderName: number | undefined
  tmdbMediaNameFromFolderName: string | undefined
  tmdbIdFromFolderNameStatus: "ready" | "loading" | "error" | undefined
  onUseTmdbidFromFolderNameConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onUseTmdbidFromFolderNameCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnUseTmdbidFromFolderNameConfirm: () => ((tmdbTvShow: TMDBTVShow) => void) | undefined // Getter for ref
  _getOnUseTmdbidFromFolderNameCancel: () => (() => void) | undefined // Getter for cancel ref
  _setOnUseTmdbidFromFolderNameConfirm: (callback: ((tmdbTvShow: TMDBTVShow) => void) | undefined) => void
  _setOnUseTmdbidFromFolderNameCancel: (callback: (() => void) | undefined) => void
  
  // RuleBasedRenameFilePrompt state
  isRuleBasedRenameFilePromptOpen: boolean
  ruleBasedRenameFileToolbarOptions: ToolbarOption[] | undefined
  ruleBasedRenameFileSelectedNamingRule: "plex" | "emby" | undefined
  ruleBasedRenameFileSetSelectedNamingRule: ((rule: "plex" | "emby") => void) | undefined
  onRuleBasedRenameFileConfirm: (() => void) | undefined
  onRuleBasedRenameFileCancel: (() => void) | undefined
  _setRuleBasedRenameFileToolbarOptions: (options: ToolbarOption[] | undefined) => void
  _setRuleBasedRenameFileSelectedNamingRule: (rule: "plex" | "emby" | undefined) => void
  _setRuleBasedRenameFileSetSelectedNamingRule: (setter: ((rule: "plex" | "emby") => void) | undefined) => void
  _setOnRuleBasedRenameFileConfirm: (callback: (() => void) | undefined) => void
  _setOnRuleBasedRenameFileCancel: (callback: (() => void) | undefined) => void
  
  // AiBasedRenameFilePrompt state
  isAiBasedRenameFilePromptOpen: boolean
  aiBasedRenameFileStatus: "generating" | "wait-for-ack" | undefined
  onAiBasedRenameFileConfirm: (() => void) | undefined
  onAiBasedRenameFileCancel: (() => void) | undefined
  _setAiBasedRenameFileStatus: (status: "generating" | "wait-for-ack" | undefined) => void
  _setOnAiBasedRenameFileConfirm: (callback: (() => void) | undefined) => void
  _setOnAiBasedRenameFileCancel: (callback: (() => void) | undefined) => void
  
  // AiBasedRecognizePrompt state
  isAiRecognizePromptOpen: boolean
  aiRecognizeStatus: "generating" | "wait-for-ack" | undefined
  aiRecognizeConfirmButtonLabel: string | undefined
  aiRecognizeConfirmButtonDisabled: boolean | undefined
  aiRecognizeIsRenaming: boolean | undefined
  onAiRecognizeConfirm: (() => void) | undefined
  onAiRecognizeCancel: (() => void) | undefined
  _setAiRecognizeStatus: (status: "generating" | "wait-for-ack" | undefined) => void
  _setAiRecognizeConfirmButtonLabel: (label: string | undefined) => void
  _setAiRecognizeConfirmButtonDisabled: (disabled: boolean | undefined) => void
  _setAiRecognizeIsRenaming: (isRenaming: boolean | undefined) => void
  _setOnAiRecognizeConfirm: (callback: (() => void) | undefined) => void
  _setOnAiRecognizeCancel: (callback: (() => void) | undefined) => void
  
  // RuleBasedRecognizePrompt state
  isRuleBasedRecognizePromptOpen: boolean
  onRuleBasedRecognizeConfirm: (() => void) | undefined
  onRuleBasedRecognizeCancel: (() => void) | undefined
  _setOnRuleBasedRecognizeConfirm: (callback: (() => void) | undefined) => void
  _setOnRuleBasedRecognizeCancel: (callback: (() => void) | undefined) => void
  
  // Internal setters (not exposed via usePrompts)
  _setIsUseNfoPromptOpen: (open: boolean) => void
  _setIsUseTmdbidFromFolderNamePromptOpen: (open: boolean) => void
  _setTmdbIdFromFolderName: (id: number | undefined) => void
  _setTmdbMediaNameFromFolderName: (name: string | undefined) => void
  _setTmdbIdFromFolderNameStatus: (status: "ready" | "loading" | "error" | undefined) => void
  _setIsRuleBasedRenameFilePromptOpen: (open: boolean) => void
  _setIsAiBasedRenameFilePromptOpen: (open: boolean) => void
  _setIsAiRecognizePromptOpen: (open: boolean) => void
  _setIsRuleBasedRecognizePromptOpen: (open: boolean) => void
}

export const PromptsContext = createContext<PromptsContextValue | undefined>(undefined)

// Provider component
interface TvShowPanelPromptsProviderProps {
  children: ReactNode
}

export function TvShowPanelPromptsProvider({ children }: TvShowPanelPromptsProviderProps) {
  // UseNfoPrompt state
  const [isUseNfoPromptOpen, setIsUseNfoPromptOpen] = useState(false)
  const [loadedNfoData, setLoadedNfoData] = useState<TMDBTVShowDetails | undefined>(undefined)
  const [onUseNfoConfirm, setOnUseNfoConfirm] = useState<((tmdbTvShow: TMDBTVShow) => void) | undefined>(undefined)
  const [onUseNfoCancel, setOnUseNfoCancel] = useState<(() => void) | undefined>(undefined)
  
  // UseTmdbidFromFolderNamePrompt state
  const [isUseTmdbidFromFolderNamePromptOpen, setIsUseTmdbidFromFolderNamePromptOpen] = useState(false)
  const [tmdbIdFromFolderName, setTmdbIdFromFolderName] = useState<number | undefined>(undefined)
  const [tmdbMediaNameFromFolderName, setTmdbMediaNameFromFolderName] = useState<string | undefined>(undefined)
  const [tmdbIdFromFolderNameStatus, setTmdbIdFromFolderNameStatus] = useState<"ready" | "loading" | "error" | undefined>(undefined)
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onUseTmdbidFromFolderNameConfirmRef = useRef<((tmdbTvShow: TMDBTVShow) => void) | undefined>(undefined)
  const onUseTmdbidFromFolderNameCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onUseTmdbidFromFolderNameConfirm, setOnUseTmdbidFromFolderNameConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onUseTmdbidFromFolderNameCancel, setOnUseTmdbidFromFolderNameCancel] = useState<boolean>(false)
  
  // RuleBasedRenameFilePrompt state
  const [isRuleBasedRenameFilePromptOpen, setIsRuleBasedRenameFilePromptOpen] = useState(false)
  const [ruleBasedRenameFileToolbarOptions, setRuleBasedRenameFileToolbarOptions] = useState<ToolbarOption[] | undefined>(undefined)
  const [ruleBasedRenameFileSelectedNamingRule, setRuleBasedRenameFileSelectedNamingRule] = useState<"plex" | "emby" | undefined>(undefined)
  const [ruleBasedRenameFileSetSelectedNamingRule, setRuleBasedRenameFileSetSelectedNamingRule] = useState<((rule: "plex" | "emby") => void) | undefined>(undefined)
  const [onRuleBasedRenameFileConfirm, setOnRuleBasedRenameFileConfirm] = useState<(() => void) | undefined>(undefined)
  const [onRuleBasedRenameFileCancel, setOnRuleBasedRenameFileCancel] = useState<(() => void) | undefined>(undefined)
  
  // AiBasedRenameFilePrompt state
  const [isAiBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen] = useState(false)
  const [aiBasedRenameFileStatus, setAiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack" | undefined>(undefined)
  const [onAiBasedRenameFileConfirm, setOnAiBasedRenameFileConfirm] = useState<(() => void) | undefined>(undefined)
  const [onAiBasedRenameFileCancel, setOnAiBasedRenameFileCancel] = useState<(() => void) | undefined>(undefined)
  
  // AiBasedRecognizePrompt state
  const [isAiRecognizePromptOpen, setIsAiRecognizePromptOpen] = useState(false)
  const [aiRecognizeStatus, setAiRecognizeStatus] = useState<"generating" | "wait-for-ack" | undefined>(undefined)
  const [aiRecognizeConfirmButtonLabel, setAiRecognizeConfirmButtonLabel] = useState<string | undefined>(undefined)
  const [aiRecognizeConfirmButtonDisabled, setAiRecognizeConfirmButtonDisabled] = useState<boolean | undefined>(undefined)
  const [aiRecognizeIsRenaming, setAiRecognizeIsRenaming] = useState<boolean | undefined>(undefined)
  const [onAiRecognizeConfirm, setOnAiRecognizeConfirm] = useState<(() => void) | undefined>(undefined)
  const [onAiRecognizeCancel, setOnAiRecognizeCancel] = useState<(() => void) | undefined>(undefined)
  
  // RuleBasedRecognizePrompt state
  const [isRuleBasedRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen] = useState(false)
  const [onRuleBasedRecognizeConfirm, setOnRuleBasedRecognizeConfirm] = useState<(() => void) | undefined>(undefined)
  const [onRuleBasedRecognizeCancel, setOnRuleBasedRecognizeCancel] = useState<(() => void) | undefined>(undefined)
  
  // Ensure only one prompt is open at a time
  useEffect(() => {
    const prompts = [
      { isOpen: isUseNfoPromptOpen, close: () => setIsUseNfoPromptOpen(false) },
      { isOpen: isUseTmdbidFromFolderNamePromptOpen, close: () => setIsUseTmdbidFromFolderNamePromptOpen(false) },
      { isOpen: isRuleBasedRenameFilePromptOpen, close: () => setIsRuleBasedRenameFilePromptOpen(false) },
      { isOpen: isAiBasedRenameFilePromptOpen, close: () => setIsAiBasedRenameFilePromptOpen(false) },
      { isOpen: isAiRecognizePromptOpen, close: () => setIsAiRecognizePromptOpen(false) },
      { isOpen: isRuleBasedRecognizePromptOpen, close: () => setIsRuleBasedRecognizePromptOpen(false) },
    ]
    const openPrompts = prompts.filter(p => p.isOpen)
    
    // If multiple prompts are open, close all except the first one
    if (openPrompts.length > 1) {
      openPrompts.slice(1).forEach(p => p.close())
    }
  }, [
    isUseNfoPromptOpen,
    isUseTmdbidFromFolderNamePromptOpen,
    isRuleBasedRenameFilePromptOpen,
    isAiBasedRenameFilePromptOpen,
    isAiRecognizePromptOpen,
    isRuleBasedRecognizePromptOpen,
  ])
  
  const value: PromptsContextValue = useMemo(() => ({
    isUseNfoPromptOpen,
    loadedNfoData,
    setLoadedNfoData,
    onUseNfoConfirm,
    onUseNfoCancel,
    isUseTmdbidFromFolderNamePromptOpen,
    tmdbIdFromFolderName,
    tmdbMediaNameFromFolderName,
    tmdbIdFromFolderNameStatus,
    onUseTmdbidFromFolderNameConfirm,
    onUseTmdbidFromFolderNameCancel,
    isRuleBasedRenameFilePromptOpen,
    ruleBasedRenameFileToolbarOptions,
    ruleBasedRenameFileSelectedNamingRule,
    ruleBasedRenameFileSetSelectedNamingRule,
    onRuleBasedRenameFileConfirm,
    onRuleBasedRenameFileCancel,
    isAiBasedRenameFilePromptOpen,
    aiBasedRenameFileStatus,
    onAiBasedRenameFileConfirm,
    onAiBasedRenameFileCancel,
    isAiRecognizePromptOpen,
    aiRecognizeStatus,
    aiRecognizeConfirmButtonLabel,
    aiRecognizeConfirmButtonDisabled,
    aiRecognizeIsRenaming,
    onAiRecognizeConfirm,
    onAiRecognizeCancel,
    isRuleBasedRecognizePromptOpen,
    onRuleBasedRecognizeConfirm,
    onRuleBasedRecognizeCancel,
    _setIsUseNfoPromptOpen: setIsUseNfoPromptOpen,
    _setOnUseNfoConfirm: setOnUseNfoConfirm,
    _setOnUseNfoCancel: setOnUseNfoCancel,
    _setIsUseTmdbidFromFolderNamePromptOpen: setIsUseTmdbidFromFolderNamePromptOpen,
    _setTmdbIdFromFolderName: setTmdbIdFromFolderName,
    _setTmdbMediaNameFromFolderName: setTmdbMediaNameFromFolderName,
    _setTmdbIdFromFolderNameStatus: setTmdbIdFromFolderNameStatus,
    _getOnUseTmdbidFromFolderNameConfirm: useCallback(() => onUseTmdbidFromFolderNameConfirmRef.current, []),
    _getOnUseTmdbidFromFolderNameCancel: useCallback(() => onUseTmdbidFromFolderNameCancelRef.current, []),
    _setOnUseTmdbidFromFolderNameConfirm: useCallback((callback: ((tmdbTvShow: TMDBTVShow) => void) | undefined) => {
      onUseTmdbidFromFolderNameConfirmRef.current = callback
      setOnUseTmdbidFromFolderNameConfirm(!!callback)
    }, [setOnUseTmdbidFromFolderNameConfirm]),
    _setOnUseTmdbidFromFolderNameCancel: useCallback((callback: (() => void) | undefined) => {
      onUseTmdbidFromFolderNameCancelRef.current = callback
      setOnUseTmdbidFromFolderNameCancel(!!callback)
    }, [setOnUseTmdbidFromFolderNameCancel]),
    _setIsRuleBasedRenameFilePromptOpen: setIsRuleBasedRenameFilePromptOpen,
    _setRuleBasedRenameFileToolbarOptions: setRuleBasedRenameFileToolbarOptions,
    _setRuleBasedRenameFileSelectedNamingRule: setRuleBasedRenameFileSelectedNamingRule,
    _setRuleBasedRenameFileSetSelectedNamingRule: setRuleBasedRenameFileSetSelectedNamingRule,
    _setOnRuleBasedRenameFileConfirm: setOnRuleBasedRenameFileConfirm,
    _setOnRuleBasedRenameFileCancel: setOnRuleBasedRenameFileCancel,
    _setIsAiBasedRenameFilePromptOpen: setIsAiBasedRenameFilePromptOpen,
    _setAiBasedRenameFileStatus: setAiBasedRenameFileStatus,
    _setOnAiBasedRenameFileConfirm: setOnAiBasedRenameFileConfirm,
    _setOnAiBasedRenameFileCancel: setOnAiBasedRenameFileCancel,
    _setIsAiRecognizePromptOpen: setIsAiRecognizePromptOpen,
    _setAiRecognizeStatus: setAiRecognizeStatus,
    _setAiRecognizeConfirmButtonLabel: setAiRecognizeConfirmButtonLabel,
    _setAiRecognizeConfirmButtonDisabled: setAiRecognizeConfirmButtonDisabled,
    _setAiRecognizeIsRenaming: setAiRecognizeIsRenaming,
    _setOnAiRecognizeConfirm: setOnAiRecognizeConfirm,
    _setOnAiRecognizeCancel: setOnAiRecognizeCancel,
    _setIsRuleBasedRecognizePromptOpen: setIsRuleBasedRecognizePromptOpen,
    _setOnRuleBasedRecognizeConfirm: setOnRuleBasedRecognizeConfirm,
    _setOnRuleBasedRecognizeCancel: setOnRuleBasedRecognizeCancel,
  }), [
    isUseNfoPromptOpen,
    loadedNfoData,
    onUseNfoConfirm,
    onUseNfoCancel,
    isUseTmdbidFromFolderNamePromptOpen,
    tmdbIdFromFolderName,
    tmdbMediaNameFromFolderName,
    tmdbIdFromFolderNameStatus,
    onUseTmdbidFromFolderNameConfirm,
    onUseTmdbidFromFolderNameCancel,
    isRuleBasedRenameFilePromptOpen,
    ruleBasedRenameFileToolbarOptions,
    ruleBasedRenameFileSelectedNamingRule,
    ruleBasedRenameFileSetSelectedNamingRule,
    onRuleBasedRenameFileConfirm,
    onRuleBasedRenameFileCancel,
    isAiBasedRenameFilePromptOpen,
    aiBasedRenameFileStatus,
    onAiBasedRenameFileConfirm,
    onAiBasedRenameFileCancel,
    isAiRecognizePromptOpen,
    aiRecognizeStatus,
    aiRecognizeConfirmButtonLabel,
    aiRecognizeConfirmButtonDisabled,
    aiRecognizeIsRenaming,
    onAiRecognizeConfirm,
    onAiRecognizeCancel,
    isRuleBasedRecognizePromptOpen,
    onRuleBasedRecognizeConfirm,
    onRuleBasedRecognizeCancel,
  ])
  
  return (
    <PromptsContext.Provider value={value}>
      {children}
    </PromptsContext.Provider>
  )
}

// Hook to open prompts
export function usePrompts() {
  const context = useContext(PromptsContext)
  if (!context) {
    throw new Error('usePrompts must be used within TvShowPanelPromptsProvider')
  }
  
  // Extract setters to avoid dependency on the whole context object
  const setIsUseNfoPromptOpen = context._setIsUseNfoPromptOpen
  const setIsRuleBasedRenameFilePromptOpen = context._setIsRuleBasedRenameFilePromptOpen
  const setIsAiBasedRenameFilePromptOpen = context._setIsAiBasedRenameFilePromptOpen
  const setIsAiRecognizePromptOpen = context._setIsAiRecognizePromptOpen
  const setIsRuleBasedRecognizePromptOpen = context._setIsRuleBasedRecognizePromptOpen
  const setTmdbIdFromFolderName = context._setTmdbIdFromFolderName
  const setTmdbMediaNameFromFolderName = context._setTmdbMediaNameFromFolderName
  const setOnUseTmdbidFromFolderNameConfirm = context._setOnUseTmdbidFromFolderNameConfirm
  const setOnUseTmdbidFromFolderNameCancel = context._setOnUseTmdbidFromFolderNameCancel
  // Note: Callbacks are now stored in refs, not state, to prevent unexpected calls during render
  const setLoadedNfoData = context.setLoadedNfoData
  const setOnUseNfoConfirm = context._setOnUseNfoConfirm
  const setOnUseNfoCancel = context._setOnUseNfoCancel
  const setRuleBasedRenameFileToolbarOptions = context._setRuleBasedRenameFileToolbarOptions
  const setRuleBasedRenameFileSelectedNamingRule = context._setRuleBasedRenameFileSelectedNamingRule
  const setRuleBasedRenameFileSetSelectedNamingRule = context._setRuleBasedRenameFileSetSelectedNamingRule
  const setOnRuleBasedRenameFileConfirm = context._setOnRuleBasedRenameFileConfirm
  const setOnRuleBasedRenameFileCancel = context._setOnRuleBasedRenameFileCancel
  const setAiBasedRenameFileStatus = context._setAiBasedRenameFileStatus
  const setOnAiBasedRenameFileConfirm = context._setOnAiBasedRenameFileConfirm
  const setOnAiBasedRenameFileCancel = context._setOnAiBasedRenameFileCancel
  const setAiRecognizeStatus = context._setAiRecognizeStatus
  const setAiRecognizeConfirmButtonLabel = context._setAiRecognizeConfirmButtonLabel
  const setAiRecognizeConfirmButtonDisabled = context._setAiRecognizeConfirmButtonDisabled
  const setAiRecognizeIsRenaming = context._setAiRecognizeIsRenaming
  const setOnAiRecognizeConfirm = context._setOnAiRecognizeConfirm
  const setOnAiRecognizeCancel = context._setOnAiRecognizeCancel
  const setOnRuleBasedRecognizeConfirm = context._setOnRuleBasedRecognizeConfirm
  const setOnRuleBasedRecognizeCancel = context._setOnRuleBasedRecognizeCancel
  
  const setTmdbIdFromFolderNameStatus = context._setTmdbIdFromFolderNameStatus
  
  const openUseTmdbIdFromFolderNamePrompt = useCallback(({ 
    tmdbId, 
    mediaName, 
    status,
    onConfirm, 
    onCancel 
  }: { 
    tmdbId: number
    mediaName?: string
    status?: "ready" | "loading" | "error"
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => {
    // Validate tmdbId before proceeding
    if (tmdbId === undefined || tmdbId === null || isNaN(tmdbId)) {
      console.warn('[TvShowPanelPrompts] openUseTmdbIdFromFolderNamePrompt called with invalid tmdbId:', tmdbId)
      return
    }

    // Close all prompts first
    setIsUseNfoPromptOpen(false)
    setIsRuleBasedRenameFilePromptOpen(false)
    setIsAiBasedRenameFilePromptOpen(false)
    setIsAiRecognizePromptOpen(false)
    setIsRuleBasedRecognizePromptOpen(false)
    
    // Set data and callbacks
    setTmdbIdFromFolderName(tmdbId)
    setTmdbMediaNameFromFolderName(mediaName)
    setTmdbIdFromFolderNameStatus(status ?? "ready")
    // Store callbacks in refs instead of state to prevent unexpected calls during render
    context._setOnUseTmdbidFromFolderNameConfirm(onConfirm)
    context._setOnUseTmdbidFromFolderNameCancel(onCancel)
    context._setIsUseTmdbidFromFolderNamePromptOpen(true)
  }, [setIsUseNfoPromptOpen, setIsRuleBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen, setIsAiRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen, setTmdbIdFromFolderName, setTmdbMediaNameFromFolderName, setTmdbIdFromFolderNameStatus, setOnUseTmdbidFromFolderNameConfirm, setOnUseTmdbidFromFolderNameCancel, context])
  
  const openUseNfoPrompt = useCallback(({ 
    nfoData, 
    onConfirm, 
    onCancel 
  }: { 
    nfoData: TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => {
    // Close all prompts first
    context._setIsUseTmdbidFromFolderNamePromptOpen(false)
    setIsRuleBasedRenameFilePromptOpen(false)
    setIsAiBasedRenameFilePromptOpen(false)
    setIsAiRecognizePromptOpen(false)
    setIsRuleBasedRecognizePromptOpen(false)
    
    // Set data and callbacks
    setLoadedNfoData(nfoData)
    setOnUseNfoConfirm(onConfirm)
    setOnUseNfoCancel(onCancel)
    setIsUseNfoPromptOpen(true)
  }, [context, setIsRuleBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen, setIsAiRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen, setLoadedNfoData, setOnUseNfoConfirm, setOnUseNfoCancel, setIsUseNfoPromptOpen])
  
  const openRuleBasedRenameFilePrompt = useCallback(({
    toolbarOptions,
    selectedNamingRule,
    setSelectedNamingRule,
    onConfirm,
    onCancel,
  }: {
    toolbarOptions: ToolbarOption[]
    selectedNamingRule: "plex" | "emby"
    setSelectedNamingRule: (rule: "plex" | "emby") => void
    onConfirm: () => void
    onCancel?: () => void
  }) => {
    // Close all prompts first
    setIsUseNfoPromptOpen(false)
    context._setIsUseTmdbidFromFolderNamePromptOpen(false)
    setIsAiBasedRenameFilePromptOpen(false)
    setIsAiRecognizePromptOpen(false)
    setIsRuleBasedRecognizePromptOpen(false)
    
    // Set data and callbacks
    setRuleBasedRenameFileToolbarOptions(toolbarOptions)
    setRuleBasedRenameFileSelectedNamingRule(selectedNamingRule)
    setRuleBasedRenameFileSetSelectedNamingRule(setSelectedNamingRule)
    setOnRuleBasedRenameFileConfirm(onConfirm)
    setOnRuleBasedRenameFileCancel(onCancel)
    setIsRuleBasedRenameFilePromptOpen(true)
  }, [context, setIsUseNfoPromptOpen, setIsAiBasedRenameFilePromptOpen, setIsAiRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen, setRuleBasedRenameFileToolbarOptions, setRuleBasedRenameFileSelectedNamingRule, setRuleBasedRenameFileSetSelectedNamingRule, setOnRuleBasedRenameFileConfirm, setOnRuleBasedRenameFileCancel, setIsRuleBasedRenameFilePromptOpen])
  
  const openAiBasedRenameFilePrompt = useCallback(({
    status,
    onConfirm,
    onCancel,
  }: {
    status: "generating" | "wait-for-ack"
    onConfirm: () => void
    onCancel?: () => void
  }) => {
    // Close all prompts first
    setIsUseNfoPromptOpen(false)
    context._setIsUseTmdbidFromFolderNamePromptOpen(false)
    setIsRuleBasedRenameFilePromptOpen(false)
    setIsAiRecognizePromptOpen(false)
    setIsRuleBasedRecognizePromptOpen(false)
    
    // Set data and callbacks
    setAiBasedRenameFileStatus(status)
    setOnAiBasedRenameFileConfirm(onConfirm)
    setOnAiBasedRenameFileCancel(onCancel)
    setIsAiBasedRenameFilePromptOpen(true)
  }, [context, setIsUseNfoPromptOpen, setIsRuleBasedRenameFilePromptOpen, setIsAiRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen, setAiBasedRenameFileStatus, setOnAiBasedRenameFileConfirm, setOnAiBasedRenameFileCancel, setIsAiBasedRenameFilePromptOpen])
  
  const openAiRecognizePrompt = useCallback(({
    status,
    confirmButtonLabel,
    confirmButtonDisabled,
    isRenaming,
    onConfirm,
    onCancel,
  }: {
    status: "generating" | "wait-for-ack"
    confirmButtonLabel: string
    confirmButtonDisabled: boolean
    isRenaming: boolean
    onConfirm: () => void
    onCancel?: () => void
  }) => {
    // Close all prompts first
    setIsUseNfoPromptOpen(false)
    context._setIsUseTmdbidFromFolderNamePromptOpen(false)
    setIsRuleBasedRenameFilePromptOpen(false)
    setIsAiBasedRenameFilePromptOpen(false)
    setIsRuleBasedRecognizePromptOpen(false)
    
    // Set data and callbacks
    setAiRecognizeStatus(status)
    setAiRecognizeConfirmButtonLabel(confirmButtonLabel)
    setAiRecognizeConfirmButtonDisabled(confirmButtonDisabled)
    setAiRecognizeIsRenaming(isRenaming)
    setOnAiRecognizeConfirm(onConfirm)
    setOnAiRecognizeCancel(onCancel)
    setIsAiRecognizePromptOpen(true)
  }, [context, setIsUseNfoPromptOpen, setIsRuleBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen, setIsRuleBasedRecognizePromptOpen, setAiRecognizeStatus, setAiRecognizeConfirmButtonLabel, setAiRecognizeConfirmButtonDisabled, setAiRecognizeIsRenaming, setOnAiRecognizeConfirm, setOnAiRecognizeCancel, setIsAiRecognizePromptOpen])
  
  const openRuleBasedRecognizePrompt = useCallback(({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void
    onCancel: () => void
  }) => {
    // Close all prompts first
    setIsUseNfoPromptOpen(false)
    context._setIsUseTmdbidFromFolderNamePromptOpen(false)
    setIsRuleBasedRenameFilePromptOpen(false)
    setIsAiBasedRenameFilePromptOpen(false)
    setIsAiRecognizePromptOpen(false)
    
    // Set callbacks
    setOnRuleBasedRecognizeConfirm(onConfirm)
    setOnRuleBasedRecognizeCancel(onCancel)
    setIsRuleBasedRecognizePromptOpen(true)
  }, [context, setIsUseNfoPromptOpen, setIsRuleBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen, setIsAiRecognizePromptOpen, setOnRuleBasedRecognizeConfirm, setOnRuleBasedRecognizeCancel, setIsRuleBasedRecognizePromptOpen])
  
  return useMemo(() => ({
    openUseTmdbIdFromFolderNamePrompt,
    openUseNfoPrompt,
    openRuleBasedRenameFilePrompt,
    openAiBasedRenameFilePrompt,
    openAiRecognizePrompt,
    openRuleBasedRecognizePrompt,
  }), [
    openUseTmdbIdFromFolderNamePrompt,
    openUseNfoPrompt,
    openRuleBasedRenameFilePrompt,
    openAiBasedRenameFilePrompt,
    openAiRecognizePrompt,
    openRuleBasedRecognizePrompt,
  ])
}

// Internal hook to access context state (used by TvShowPanelPrompts component and other components that need to read state)
export function usePromptsContext() {
  const context = useContext(PromptsContext)
  if (!context) {
    throw new Error('usePromptsContext must be used within TvShowPanelPromptsProvider')
  }
  return context
}

// Props for TvShowPanelPrompts component (no props needed, all state from context)
interface TvShowPanelPromptsProps {
}

export function TvShowPanelPrompts({}: TvShowPanelPromptsProps) {
  const context = usePromptsContext()
  
  return (
    <div className="absolute top-0 left-0 w-full z-20">
      <UseNfoPrompt
        isOpen={context.isUseNfoPromptOpen}
        mediaName={context.loadedNfoData?.name}
        tmdbid={context.loadedNfoData?.id}
        onConfirm={() => {
          context._setIsUseNfoPromptOpen(false)
          
          // Store callback and data before clearing state
          const callback = context.onUseNfoConfirm
          const nfoData = context.loadedNfoData
          
          // Clear state first
          context.setLoadedNfoData(undefined)
          context._setOnUseNfoConfirm(undefined)
          context._setOnUseNfoCancel(undefined)
          
          // Then call callback if valid
          if (nfoData?.id && callback) {
            // Create a minimal TMDBTVShow object with just the ID
            // handleSelectResult will fetch the full details
            const minimalTvShow: TMDBTVShow = {
              id: nfoData.id,
              name: '',
              original_name: '',
              overview: '',
              poster_path: null,
              backdrop_path: null,
              first_air_date: '',
              vote_average: 0,
              vote_count: 0,
              popularity: 0,
              genre_ids: [],
              origin_country: [],
              media_type: 'tv'
            }
            
            callback(minimalTvShow)
          }
        }}
        onCancel={() => {
          context._setIsUseNfoPromptOpen(false)
          context.setLoadedNfoData(undefined)
          if (context.onUseNfoCancel) {
            context.onUseNfoCancel()
          }
          context._setOnUseNfoConfirm(undefined)
          context._setOnUseNfoCancel(undefined)
        }}
      />

      <UseTmdbidFromFolderNamePrompt
        isOpen={context.isUseTmdbidFromFolderNamePromptOpen}
        mediaName={context.tmdbMediaNameFromFolderName}
        tmdbid={context.tmdbIdFromFolderName}
        status={context.tmdbIdFromFolderNameStatus ?? "ready"}
        onConfirm={() => {
          // Only allow confirmation when status is "ready"
          const currentStatus = context.tmdbIdFromFolderNameStatus ?? "ready"
          if (currentStatus !== "ready") {
            // Don't proceed if still loading or in error state
            return
          }

          context._setIsUseTmdbidFromFolderNamePromptOpen(false)
          
          // Store callback and data before clearing state - use ref to get the actual callback
          const callback = context._getOnUseTmdbidFromFolderNameConfirm()
          const tmdbId = context.tmdbIdFromFolderName
          
          // Clear state first
          context._setTmdbIdFromFolderName(undefined)
          context._setTmdbMediaNameFromFolderName(undefined)
          context._setTmdbIdFromFolderNameStatus(undefined)
          context._setOnUseTmdbidFromFolderNameConfirm(undefined)
          context._setOnUseTmdbidFromFolderNameCancel(undefined)
          
          // Then call callback if valid
          // Double check that we have valid data before calling callback
          if (tmdbId !== undefined && tmdbId !== null && !isNaN(tmdbId) && typeof tmdbId === 'number' && callback) {
            // Create a minimal TMDBTVShow object with just the ID
            // handleSelectResult will fetch the full details
            const minimalTvShow: TMDBTVShow = {
              id: tmdbId,
              name: '',
              original_name: '',
              overview: '',
              poster_path: null,
              backdrop_path: null,
              first_air_date: '',
              vote_average: 0,
              vote_count: 0,
              popularity: 0,
              genre_ids: [],
              origin_country: [],
              media_type: 'tv'
            }
            
            callback(minimalTvShow)
          } else {
            // Log warning if callback would be called with invalid data
            if (callback && (tmdbId === undefined || tmdbId === null || isNaN(tmdbId) || typeof tmdbId !== 'number')) {
              console.warn('[TvShowPanelPrompts] Attempted to call onConfirm with invalid tmdbId:', tmdbId, 'status:', currentStatus)
            }
          }
        }}
        onCancel={() => {
          context._setIsUseTmdbidFromFolderNamePromptOpen(false)
          context._setTmdbIdFromFolderName(undefined)
          context._setTmdbMediaNameFromFolderName(undefined)
          const cancelCallback = context._getOnUseTmdbidFromFolderNameCancel()
          context._setOnUseTmdbidFromFolderNameConfirm(undefined)
          context._setOnUseTmdbidFromFolderNameCancel(undefined)
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <RuleBasedRenameFilePrompt
        isOpen={context.isRuleBasedRenameFilePromptOpen}
        namingRuleOptions={context.ruleBasedRenameFileToolbarOptions || []}
        selectedNamingRule={context.ruleBasedRenameFileSelectedNamingRule || "plex"}
        onNamingRuleChange={(value) => {
          if (context.ruleBasedRenameFileSetSelectedNamingRule) {
            context.ruleBasedRenameFileSetSelectedNamingRule(value as "plex" | "emby")
            context._setRuleBasedRenameFileSelectedNamingRule(value as "plex" | "emby")
          }
        }}
        onConfirm={() => {
          context._setIsRuleBasedRenameFilePromptOpen(false)
          if (context.onRuleBasedRenameFileConfirm) {
            context.onRuleBasedRenameFileConfirm()
          }
          // Clean up
          context._setRuleBasedRenameFileToolbarOptions(undefined)
          context._setRuleBasedRenameFileSelectedNamingRule(undefined)
          context._setRuleBasedRenameFileSetSelectedNamingRule(undefined)
          context._setOnRuleBasedRenameFileConfirm(undefined)
          context._setOnRuleBasedRenameFileCancel(undefined)
        }}
        onCancel={() => {
          context._setIsRuleBasedRenameFilePromptOpen(false)
          if (context.onRuleBasedRenameFileCancel) {
            context.onRuleBasedRenameFileCancel()
          }
          // Clean up
          context._setRuleBasedRenameFileToolbarOptions(undefined)
          context._setRuleBasedRenameFileSelectedNamingRule(undefined)
          context._setRuleBasedRenameFileSetSelectedNamingRule(undefined)
          context._setOnRuleBasedRenameFileConfirm(undefined)
          context._setOnRuleBasedRenameFileCancel(undefined)
        }}
      />

      <AiBasedRenameFilePrompt
        isOpen={context.isAiBasedRenameFilePromptOpen}
        status={context.aiBasedRenameFileStatus || "generating"}
        onConfirm={() => {
          context._setIsAiBasedRenameFilePromptOpen(false)
          if (context.onAiBasedRenameFileConfirm) {
            context.onAiBasedRenameFileConfirm()
          }
          // Clean up
          context._setAiBasedRenameFileStatus(undefined)
          context._setOnAiBasedRenameFileConfirm(undefined)
          context._setOnAiBasedRenameFileCancel(undefined)
        }}
        onCancel={() => {
          context._setIsAiBasedRenameFilePromptOpen(false)
          if (context.onAiBasedRenameFileCancel) {
            context.onAiBasedRenameFileCancel()
          }
          // Clean up
          context._setAiBasedRenameFileStatus(undefined)
          context._setOnAiBasedRenameFileConfirm(undefined)
          context._setOnAiBasedRenameFileCancel(undefined)
        }}
      />

      <AiBasedRecognizePrompt
        isOpen={context.isAiRecognizePromptOpen}
        status={context.aiRecognizeStatus || "generating"}
        onConfirm={() => {
          context._setIsAiRecognizePromptOpen(false)
          if (context.onAiRecognizeConfirm) {
            context.onAiRecognizeConfirm()
          }
          // Clean up
          context._setAiRecognizeStatus(undefined)
          context._setAiRecognizeConfirmButtonLabel(undefined)
          context._setAiRecognizeConfirmButtonDisabled(undefined)
          context._setAiRecognizeIsRenaming(undefined)
          context._setOnAiRecognizeConfirm(undefined)
          context._setOnAiRecognizeCancel(undefined)
        }}
        onCancel={() => {
          context._setIsAiRecognizePromptOpen(false)
          if (context.onAiRecognizeCancel) {
            context.onAiRecognizeCancel()
          }
          // Clean up
          context._setAiRecognizeStatus(undefined)
          context._setAiRecognizeConfirmButtonLabel(undefined)
          context._setAiRecognizeConfirmButtonDisabled(undefined)
          context._setAiRecognizeIsRenaming(undefined)
          context._setOnAiRecognizeConfirm(undefined)
          context._setOnAiRecognizeCancel(undefined)
        }}
        confirmLabel={context.aiRecognizeConfirmButtonLabel || ""}
        isConfirmButtonDisabled={context.aiRecognizeConfirmButtonDisabled || false}
        isConfirmDisabled={context.aiRecognizeIsRenaming || false}
      />

      <RuleBasedRecognizePrompt
        isOpen={context.isRuleBasedRecognizePromptOpen}
        onConfirm={() => {
          context._setIsRuleBasedRecognizePromptOpen(false)
          if (context.onRuleBasedRecognizeConfirm) {
            context.onRuleBasedRecognizeConfirm()
          }
          // Clean up
          context._setOnRuleBasedRecognizeConfirm(undefined)
          context._setOnRuleBasedRecognizeCancel(undefined)
        }}
        onCancel={() => {
          context._setIsRuleBasedRecognizePromptOpen(false)
          if (context.onRuleBasedRecognizeCancel) {
            context.onRuleBasedRecognizeCancel()
          }
          // Clean up
          context._setOnRuleBasedRecognizeConfirm(undefined)
          context._setOnRuleBasedRecognizeCancel(undefined)
        }}
      />
    </div>
  )
}
