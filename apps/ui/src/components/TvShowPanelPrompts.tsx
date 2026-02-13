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
  onUseNfoConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onUseNfoCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnUseNfoConfirm: () => ((tmdbTvShow: TMDBTVShow) => void) | undefined // Getter for ref
  _getOnUseNfoCancel: () => (() => void) | undefined // Getter for cancel ref
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
  onRuleBasedRenameFileConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onRuleBasedRenameFileCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnRuleBasedRenameFileConfirm: () => (() => void) | undefined // Getter for ref
  _getOnRuleBasedRenameFileCancel: () => (() => void) | undefined // Getter for cancel ref
  _setRuleBasedRenameFileToolbarOptions: (options: ToolbarOption[] | undefined) => void
  _setRuleBasedRenameFileSelectedNamingRule: (rule: "plex" | "emby" | undefined) => void
  _setRuleBasedRenameFileSetSelectedNamingRule: (setter: ((rule: "plex" | "emby") => void) | undefined) => void
  _setOnRuleBasedRenameFileConfirm: (callback: (() => void) | undefined) => void
  _setOnRuleBasedRenameFileCancel: (callback: (() => void) | undefined) => void
  
  // AiBasedRenameFilePrompt state
  isAiBasedRenameFilePromptOpen: boolean
  aiBasedRenameFileStatus: "generating" | "wait-for-ack" | undefined
  onAiBasedRenameFileConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onAiBasedRenameFileCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnAiBasedRenameFileConfirm: () => (() => void) | undefined // Getter for ref
  _getOnAiBasedRenameFileCancel: () => (() => void) | undefined // Getter for cancel ref
  _setAiBasedRenameFileStatus: (status: "generating" | "wait-for-ack" | undefined) => void
  _setOnAiBasedRenameFileConfirm: (callback: (() => void) | undefined) => void
  _setOnAiBasedRenameFileCancel: (callback: (() => void) | undefined) => void
  
  // AiBasedRecognizePrompt state
  isAiRecognizePromptOpen: boolean
  aiRecognizeStatus: "generating" | "wait-for-ack" | undefined
  aiRecognizeConfirmButtonLabel: string | undefined
  aiRecognizeConfirmButtonDisabled: boolean | undefined
  aiRecognizeIsRenaming: boolean | undefined
  onAiRecognizeConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onAiRecognizeCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnAiRecognizeConfirm: () => (() => void) | undefined // Getter for ref
  _getOnAiRecognizeCancel: () => (() => void) | undefined // Getter for cancel ref
  _setAiRecognizeStatus: (status: "generating" | "wait-for-ack" | undefined) => void
  _setAiRecognizeConfirmButtonLabel: (label: string | undefined) => void
  _setAiRecognizeConfirmButtonDisabled: (disabled: boolean | undefined) => void
  _setAiRecognizeIsRenaming: (isRenaming: boolean | undefined) => void
  _setOnAiRecognizeConfirm: (callback: (() => void) | undefined) => void
  _setOnAiRecognizeCancel: (callback: (() => void) | undefined) => void
  
  // RuleBasedRecognizePrompt state
  isRuleBasedRecognizePromptOpen: boolean
  onRuleBasedRecognizeConfirm: boolean // Just tracks if callback exists, actual callback stored in ref
  onRuleBasedRecognizeCancel: boolean // Just tracks if callback exists, actual callback stored in ref
  _getOnRuleBasedRecognizeConfirm: () => (() => void) | undefined // Getter for ref
  _getOnRuleBasedRecognizeCancel: () => (() => void) | undefined // Getter for cancel ref
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
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onUseNfoConfirmRef = useRef<((tmdbTvShow: TMDBTVShow) => void) | undefined>(undefined)
  const onUseNfoCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onUseNfoConfirm, setOnUseNfoConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onUseNfoCancel, setOnUseNfoCancel] = useState<boolean>(false)
  
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
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onRuleBasedRenameFileConfirmRef = useRef<(() => void) | undefined>(undefined)
  const onRuleBasedRenameFileCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onRuleBasedRenameFileConfirm, setOnRuleBasedRenameFileConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onRuleBasedRenameFileCancel, setOnRuleBasedRenameFileCancel] = useState<boolean>(false)
  
  // AiBasedRenameFilePrompt state
  const [isAiBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen] = useState(false)
  const [aiBasedRenameFileStatus, setAiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack" | undefined>(undefined)
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onAiBasedRenameFileConfirmRef = useRef<(() => void) | undefined>(undefined)
  const onAiBasedRenameFileCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onAiBasedRenameFileConfirm, setOnAiBasedRenameFileConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onAiBasedRenameFileCancel, setOnAiBasedRenameFileCancel] = useState<boolean>(false)
  
  // AiBasedRecognizePrompt state
  const [isAiRecognizePromptOpen, setIsAiRecognizePromptOpen] = useState(false)
  const [aiRecognizeStatus, setAiRecognizeStatus] = useState<"generating" | "wait-for-ack" | undefined>(undefined)
  const [aiRecognizeConfirmButtonLabel, setAiRecognizeConfirmButtonLabel] = useState<string | undefined>(undefined)
  const [aiRecognizeConfirmButtonDisabled, setAiRecognizeConfirmButtonDisabled] = useState<boolean | undefined>(undefined)
  const [aiRecognizeIsRenaming, setAiRecognizeIsRenaming] = useState<boolean | undefined>(undefined)
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onAiRecognizeConfirmRef = useRef<(() => void) | undefined>(undefined)
  const onAiRecognizeCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onAiRecognizeConfirm, setOnAiRecognizeConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onAiRecognizeCancel, setOnAiRecognizeCancel] = useState<boolean>(false)
  
  // RuleBasedRecognizePrompt state
  const [isRuleBasedRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen] = useState(false)
  // Use refs to store callbacks to prevent them from being called unexpectedly during render
  const onRuleBasedRecognizeConfirmRef = useRef<(() => void) | undefined>(undefined)
  const onRuleBasedRecognizeCancelRef = useRef<(() => void) | undefined>(undefined)
  // Keep state versions for context (but don't store the actual functions)
  const [onRuleBasedRecognizeConfirm, setOnRuleBasedRecognizeConfirm] = useState<boolean>(false) // Just track if callback exists
  const [onRuleBasedRecognizeCancel, setOnRuleBasedRecognizeCancel] = useState<boolean>(false)
  
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
  
  // Define getters and setters for UseNfoPrompt callbacks (similar to UseTmdbidFromFolderNamePrompt)
  const _getOnUseNfoConfirm = useCallback(() => onUseNfoConfirmRef.current, [])
  const _getOnUseNfoCancel = useCallback(() => onUseNfoCancelRef.current, [])
  const _setOnUseNfoConfirm = useCallback((callback: ((tmdbTvShow: TMDBTVShow) => void) | undefined) => {
    onUseNfoConfirmRef.current = callback
    setOnUseNfoConfirm(!!callback)
  }, [])
  const _setOnUseNfoCancel = useCallback((callback: (() => void) | undefined) => {
    onUseNfoCancelRef.current = callback
    setOnUseNfoCancel(!!callback)
  }, [])
  
  // Define getters and setters for RuleBasedRenameFilePrompt callbacks
  const _getOnRuleBasedRenameFileConfirm = useCallback(() => onRuleBasedRenameFileConfirmRef.current, [])
  const _getOnRuleBasedRenameFileCancel = useCallback(() => onRuleBasedRenameFileCancelRef.current, [])
  const _setOnRuleBasedRenameFileConfirm = useCallback((callback: (() => void) | undefined) => {
    onRuleBasedRenameFileConfirmRef.current = callback
    setOnRuleBasedRenameFileConfirm(!!callback)
  }, [])
  const _setOnRuleBasedRenameFileCancel = useCallback((callback: (() => void) | undefined) => {
    onRuleBasedRenameFileCancelRef.current = callback
    setOnRuleBasedRenameFileCancel(!!callback)
  }, [])
  
  // Define getters and setters for AiBasedRenameFilePrompt callbacks
  const _getOnAiBasedRenameFileConfirm = useCallback(() => onAiBasedRenameFileConfirmRef.current, [])
  const _getOnAiBasedRenameFileCancel = useCallback(() => onAiBasedRenameFileCancelRef.current, [])
  const _setOnAiBasedRenameFileConfirm = useCallback((callback: (() => void) | undefined) => {
    onAiBasedRenameFileConfirmRef.current = callback
    setOnAiBasedRenameFileConfirm(!!callback)
  }, [])
  const _setOnAiBasedRenameFileCancel = useCallback((callback: (() => void) | undefined) => {
    onAiBasedRenameFileCancelRef.current = callback
    setOnAiBasedRenameFileCancel(!!callback)
  }, [])
  
  // Define getters and setters for AiBasedRecognizePrompt callbacks
  const _getOnAiRecognizeConfirm = useCallback(() => onAiRecognizeConfirmRef.current, [])
  const _getOnAiRecognizeCancel = useCallback(() => onAiRecognizeCancelRef.current, [])
  const _setOnAiRecognizeConfirm = useCallback((callback: (() => void) | undefined) => {
    onAiRecognizeConfirmRef.current = callback
    setOnAiRecognizeConfirm(!!callback)
  }, [])
  const _setOnAiRecognizeCancel = useCallback((callback: (() => void) | undefined) => {
    onAiRecognizeCancelRef.current = callback
    setOnAiRecognizeCancel(!!callback)
  }, [])
  
  // Define getters and setters for RuleBasedRecognizePrompt callbacks
  const _getOnRuleBasedRecognizeConfirm = useCallback(() => onRuleBasedRecognizeConfirmRef.current, [])
  const _getOnRuleBasedRecognizeCancel = useCallback(() => onRuleBasedRecognizeCancelRef.current, [])
  const _setOnRuleBasedRecognizeConfirm = useCallback((callback: (() => void) | undefined) => {
    onRuleBasedRecognizeConfirmRef.current = callback
    setOnRuleBasedRecognizeConfirm(!!callback)
  }, [])
  const _setOnRuleBasedRecognizeCancel = useCallback((callback: (() => void) | undefined) => {
    onRuleBasedRecognizeCancelRef.current = callback
    setOnRuleBasedRecognizeCancel(!!callback)
  }, [])
  
  const value: PromptsContextValue = useMemo(() => ({
    isUseNfoPromptOpen,
    loadedNfoData,
    setLoadedNfoData,
    onUseNfoConfirm,
    onUseNfoCancel,
    _getOnUseNfoConfirm,
    _getOnUseNfoCancel,
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
    _setOnUseNfoConfirm,
    _setOnUseNfoCancel,
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
    _getOnRuleBasedRenameFileConfirm,
    _getOnRuleBasedRenameFileCancel,
    _setOnRuleBasedRenameFileConfirm,
    _setOnRuleBasedRenameFileCancel,
    _setIsAiBasedRenameFilePromptOpen: setIsAiBasedRenameFilePromptOpen,
    _setAiBasedRenameFileStatus: setAiBasedRenameFileStatus,
    _getOnAiBasedRenameFileConfirm,
    _getOnAiBasedRenameFileCancel,
    _setOnAiBasedRenameFileConfirm,
    _setOnAiBasedRenameFileCancel,
    _setIsAiRecognizePromptOpen: setIsAiRecognizePromptOpen,
    _setAiRecognizeStatus: setAiRecognizeStatus,
    _setAiRecognizeConfirmButtonLabel: setAiRecognizeConfirmButtonLabel,
    _setAiRecognizeConfirmButtonDisabled: setAiRecognizeConfirmButtonDisabled,
    _setAiRecognizeIsRenaming: setAiRecognizeIsRenaming,
    _getOnAiRecognizeConfirm,
    _getOnAiRecognizeCancel,
    _setOnAiRecognizeConfirm,
    _setOnAiRecognizeCancel,
    _setIsRuleBasedRecognizePromptOpen: setIsRuleBasedRecognizePromptOpen,
    _getOnRuleBasedRecognizeConfirm,
    _getOnRuleBasedRecognizeCancel,
    _setOnRuleBasedRecognizeConfirm,
    _setOnRuleBasedRecognizeCancel,
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
    _getOnUseNfoConfirm,
    _getOnUseNfoCancel,
    _setOnUseNfoConfirm,
    _setOnUseNfoCancel,
    _getOnRuleBasedRenameFileConfirm,
    _getOnRuleBasedRenameFileCancel,
    _setOnRuleBasedRenameFileConfirm,
    _setOnRuleBasedRenameFileCancel,
    _getOnAiBasedRenameFileConfirm,
    _getOnAiBasedRenameFileCancel,
    _setOnAiBasedRenameFileConfirm,
    _setOnAiBasedRenameFileCancel,
    _getOnAiRecognizeConfirm,
    _getOnAiRecognizeCancel,
    _setOnAiRecognizeConfirm,
    _setOnAiRecognizeCancel,
    _getOnRuleBasedRecognizeConfirm,
    _getOnRuleBasedRecognizeCancel,
    _setOnRuleBasedRecognizeConfirm,
    _setOnRuleBasedRecognizeCancel,
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
  // Note: Callbacks are now stored in refs, not state, to prevent unexpected calls during render
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
    console.log('[TvShowPanelPrompts] openUseNfoPrompt CALLED', {
      timestamp: new Date().toISOString(),
      nfoDataId: nfoData?.id,
      hasOnConfirm: !!onConfirm,
      stackTrace: new Error().stack
    })
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
          console.log('[TvShowPanelPrompts] UseNfoPrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: context.onUseNfoConfirm,
            nfoDataId: context.loadedNfoData?.id,
            stackTrace: new Error().stack
          })
          context._setIsUseNfoPromptOpen(false)
          
          // Store callback and data before clearing state - use ref to get the actual callback
          const callback = context._getOnUseNfoConfirm()
          const nfoData = context.loadedNfoData
          
          // Clear state first
          context.setLoadedNfoData(undefined)
          context._setOnUseNfoConfirm(undefined)
          context._setOnUseNfoCancel(undefined)
          
          // Then call callback if valid
          if (nfoData?.id && callback) {
            console.log('[TvShowPanelPrompts] UseNfoPrompt INVOKING callback', {
              timestamp: new Date().toISOString(),
              nfoDataId: nfoData.id,
              callbackType: typeof callback
            })
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
          } else {
            console.warn('[TvShowPanelPrompts] UseNfoPrompt callback NOT invoked', {
              timestamp: new Date().toISOString(),
              hasNfoData: !!nfoData,
              nfoDataId: nfoData?.id,
              hasCallback: !!callback
            })
          }
        }}
        onCancel={() => {
          context._setIsUseNfoPromptOpen(false)
          context.setLoadedNfoData(undefined)
          const cancelCallback = context._getOnUseNfoCancel()
          context._setOnUseNfoConfirm(undefined)
          context._setOnUseNfoCancel(undefined)
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <UseTmdbidFromFolderNamePrompt
        isOpen={context.isUseTmdbidFromFolderNamePromptOpen}
        mediaName={context.tmdbMediaNameFromFolderName}
        tmdbid={context.tmdbIdFromFolderName}
        status={context.tmdbIdFromFolderNameStatus ?? "ready"}
        onConfirm={() => {
          console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            status: context.tmdbIdFromFolderNameStatus ?? "ready",
            tmdbId: context.tmdbIdFromFolderName,
            stackTrace: new Error().stack
          })
          // Only allow confirmation when status is "ready"
          const currentStatus = context.tmdbIdFromFolderNameStatus ?? "ready"
          if (currentStatus !== "ready") {
            // Don't proceed if still loading or in error state
            console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt onConfirm BLOCKED - status not ready', {
              timestamp: new Date().toISOString(),
              currentStatus
            })
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
            console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt INVOKING callback', {
              timestamp: new Date().toISOString(),
              tmdbId,
              callbackType: typeof callback
            })
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
            } else {
              console.warn('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt callback NOT invoked', {
                timestamp: new Date().toISOString(),
                hasCallback: !!callback,
                tmdbId,
                tmdbIdType: typeof tmdbId
              })
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
          console.log('[TvShowPanelPrompts] RuleBasedRenameFilePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!context.onRuleBasedRenameFileConfirm,
            stackTrace: new Error().stack
          })
          context._setIsRuleBasedRenameFilePromptOpen(false)
          const callback = context._getOnRuleBasedRenameFileConfirm()
          if (callback) {
            console.log('[TvShowPanelPrompts] RuleBasedRenameFilePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
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
          const cancelCallback = context._getOnRuleBasedRenameFileCancel()
          if (cancelCallback) {
            cancelCallback()
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
          console.log('[TvShowPanelPrompts] AiBasedRenameFilePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!context.onAiBasedRenameFileConfirm,
            status: context.aiBasedRenameFileStatus,
            stackTrace: new Error().stack
          })
          context._setIsAiBasedRenameFilePromptOpen(false)
          const callback = context._getOnAiBasedRenameFileConfirm()
          if (callback) {
            console.log('[TvShowPanelPrompts] AiBasedRenameFilePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
          }
          // Clean up
          context._setAiBasedRenameFileStatus(undefined)
          context._setOnAiBasedRenameFileConfirm(undefined)
          context._setOnAiBasedRenameFileCancel(undefined)
        }}
        onCancel={() => {
          context._setIsAiBasedRenameFilePromptOpen(false)
          const cancelCallback = context._getOnAiBasedRenameFileCancel()
          if (cancelCallback) {
            cancelCallback()
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
          console.log('[TvShowPanelPrompts] AiBasedRecognizePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!context.onAiRecognizeConfirm,
            status: context.aiRecognizeStatus,
            stackTrace: new Error().stack
          })
          context._setIsAiRecognizePromptOpen(false)
          const callback = context._getOnAiRecognizeConfirm()
          if (callback) {
            console.log('[TvShowPanelPrompts] AiBasedRecognizePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
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
          const cancelCallback = context._getOnAiRecognizeCancel()
          if (cancelCallback) {
            cancelCallback()
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
          console.log('[TvShowPanelPrompts] RuleBasedRecognizePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!context.onRuleBasedRecognizeConfirm,
            stackTrace: new Error().stack
          })
          context._setIsRuleBasedRecognizePromptOpen(false)
          const callback = context._getOnRuleBasedRecognizeConfirm()
          if (callback) {
            console.log('[TvShowPanelPrompts] RuleBasedRecognizePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
          }
          // Clean up
          context._setOnRuleBasedRecognizeConfirm(undefined)
          context._setOnRuleBasedRecognizeCancel(undefined)
        }}
        onCancel={() => {
          context._setIsRuleBasedRecognizePromptOpen(false)
          const cancelCallback = context._getOnRuleBasedRecognizeCancel()
          if (cancelCallback) {
            cancelCallback()
          }
          // Clean up
          context._setOnRuleBasedRecognizeConfirm(undefined)
          context._setOnRuleBasedRecognizeCancel(undefined)
        }}
      />
    </div>
  )
}
