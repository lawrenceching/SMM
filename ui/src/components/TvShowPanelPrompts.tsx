import { UseNfoPrompt } from "./UseNfoPrompt"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import type { TMDBTVShow, TMDBTVShowDetails } from "@core/types"

interface ToolbarOption {
  value: "plex" | "emby"
  label: string
}

interface TvShowPanelPromptsProps {
  // UseNfoPrompt props
  isUseNfoPromptOpen: boolean
  setIsUseNfoPromptOpen: (open: boolean) => void
  loadedNfoData: TMDBTVShowDetails | undefined
  setLoadedNfoData: (data: TMDBTVShowDetails | undefined) => void
  onUseNfoConfirm: (tmdbTvShow: TMDBTVShow) => void
  
  // RuleBasedRenameFilePrompt props
  isRuleBasedRenameFilePromptOpen: boolean
  setIsRuleBasedRenameFilePromptOpen: (open: boolean) => void
  toolbarOptions: ToolbarOption[]
  selectedNamingRule: "plex" | "emby"
  setSelectedNamingRule: (rule: "plex" | "emby") => void
  onRuleBasedRenameConfirm: () => void
  
  // AiBasedRenameFilePrompt props
  isAiBasedRenameFilePromptOpen: boolean
  setIsAiBasedRenameFilePromptOpen: (open: boolean) => void
  aiBasedRenameFileStatus: "generating" | "wait-for-ack"
  onAiBasedRenameConfirm: () => void
  
  // AiBasedRecognizePrompt props
  isAiRecognizePromptOpen: boolean
  setIsAiRecognizePromptOpen: (open: boolean) => void
  aiRecognizeStatus: "generating" | "wait-for-ack"
  confirmButtonLabel: string
  confirmButtonDisabled: boolean
  isRenaming: boolean
  
  // RuleBasedRecognizePrompt props
  isRuleBasedRecognizePromptOpen: boolean
  onRuleBasedRecognizeConfirm: () => void
  onRuleBasedRecognizeCancel: () => void
}

export function TvShowPanelPrompts({
  isUseNfoPromptOpen,
  setIsUseNfoPromptOpen,
  loadedNfoData,
  setLoadedNfoData,
  onUseNfoConfirm,
  isRuleBasedRenameFilePromptOpen,
  setIsRuleBasedRenameFilePromptOpen,
  toolbarOptions,
  selectedNamingRule,
  setSelectedNamingRule,
  onRuleBasedRenameConfirm,
  isAiBasedRenameFilePromptOpen,
  setIsAiBasedRenameFilePromptOpen,
  aiBasedRenameFileStatus,
  onAiBasedRenameConfirm,
  isAiRecognizePromptOpen,
  setIsAiRecognizePromptOpen,
  aiRecognizeStatus,
  confirmButtonLabel,
  confirmButtonDisabled,
  isRenaming,
  isRuleBasedRecognizePromptOpen,
  onRuleBasedRecognizeConfirm,
  onRuleBasedRecognizeCancel,
}: TvShowPanelPromptsProps) {
  return (
    <div className="absolute top-0 left-0 w-full z-20">
      <UseNfoPrompt
        isOpen={isUseNfoPromptOpen}
        mediaName={loadedNfoData?.name}
        tmdbid={loadedNfoData?.id}
        onConfirm={() => {
          setIsUseNfoPromptOpen(false)
          if (loadedNfoData?.id) {
            // Create a minimal TMDBTVShow object with just the ID
            // handleSelectResult will fetch the full details
            const minimalTvShow: TMDBTVShow = {
              id: loadedNfoData.id,
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
            
            onUseNfoConfirm(minimalTvShow)
          }
          setLoadedNfoData(undefined)
        }}
        onCancel={() => {
          setIsUseNfoPromptOpen(false)
          setLoadedNfoData(undefined)
        }}
      />

      <RuleBasedRenameFilePrompt
        isOpen={isRuleBasedRenameFilePromptOpen}
        namingRuleOptions={toolbarOptions}
        selectedNamingRule={selectedNamingRule}
        onNamingRuleChange={(value) => {
          setSelectedNamingRule(value as "plex" | "emby")
        }}
        onConfirm={onRuleBasedRenameConfirm}
        onCancel={() => setIsRuleBasedRenameFilePromptOpen(false)}
      />

      <AiBasedRenameFilePrompt
        isOpen={isAiBasedRenameFilePromptOpen}
        status={aiBasedRenameFileStatus}
        onConfirm={onAiBasedRenameConfirm}
        onCancel={() => setIsAiBasedRenameFilePromptOpen(false)}
      />

      <AiBasedRecognizePrompt
        isOpen={isAiRecognizePromptOpen}
        status={aiRecognizeStatus}
        onConfirm={() => {
          setIsAiRecognizePromptOpen(false)
        }}
        onCancel={() => {
          setIsAiRecognizePromptOpen(false)
        }}
        confirmLabel={confirmButtonLabel}
        isConfirmButtonDisabled={confirmButtonDisabled}
        isConfirmDisabled={isRenaming}
      />

      <RuleBasedRecognizePrompt
        isOpen={isRuleBasedRecognizePromptOpen}
        onConfirm={onRuleBasedRecognizeConfirm}
        onCancel={onRuleBasedRecognizeCancel}
      />
    </div>
  )
}
