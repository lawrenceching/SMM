import { UseNfoPrompt } from "./UseNfoPrompt"
import { UseTmdbidFromFolderNamePrompt } from "./UseTmdbidFromFolderNamePrompt"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import type { TMDBTVShow } from "@core/types"
import { useTmdbIdFromFolderNamePromptStore } from "@/stores/useTmdbIdFromFolderNamePromptStore"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { usePlansStore } from "@/stores/plansStore"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"

export function TvShowPanelPrompts() {
  const tmdbPromptStore = useTmdbIdFromFolderNamePromptStore()
  const plans = usePlansStore((state) => state.plans)

  const useNfoPrompt = useTvShowPromptsStore((state) => state.useNfoPrompt)
  const ruleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
  const aiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const aiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
  const ruleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)
   
  // Rule-based recognize tmp plan is added via setPlans() in TvShowPanel (in `plans`), not via addTmpRecognizePlan (in `pendingPlans`).
  const ruleBasedPlan = ruleBasedRecognizePrompt.planId
    ? (plans.find((p) => p.id === ruleBasedRecognizePrompt.planId) ?? plans.find((p) => p.id === ruleBasedRecognizePrompt.planId))
    : undefined
  const isRuleBasedRecognizeLoading = ruleBasedPlan?.status === 'loading'

  const closeUseNfoPrompt = useTvShowPromptsStore((state) => state.closeUseNfoPrompt)
  const closeRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeRuleBasedRenameFilePrompt)
  const updateRuleBasedRenameFilePromptSelectedRule = useTvShowPromptsStore((state) => state.updateRuleBasedRenameFilePromptSelectedRule)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)
  const closeRuleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeRuleBasedRecognizePrompt)

  return (
    <div>
      <UseNfoPrompt
        isOpen={useNfoPrompt.isOpen}
        mediaName={useNfoPrompt.mediaName}
        tmdbid={useNfoPrompt.tmdbid}
        onConfirm={() => {
          const callback = useNfoPrompt.onConfirm
          const nfoData = useNfoPrompt.data
          closeUseNfoPrompt()
          
          if (nfoData && callback) {
            const minimalTvShow: TMDBTVShow = {
              id: nfoData.id,
              name: nfoData.name,
              original_name: nfoData.original_name,
              overview: nfoData.overview,
              poster_path: nfoData.poster_path,
              backdrop_path: nfoData.backdrop_path,
              first_air_date: nfoData.first_air_date,
              vote_average: nfoData.vote_average,
              vote_count: nfoData.vote_count,
              popularity: nfoData.popularity,
              genre_ids: nfoData.genre_ids,
              origin_country: nfoData.origin_country,
              media_type: 'tv'
            }
            callback(minimalTvShow)
          }
        }}
        onCancel={() => {
          closeUseNfoPrompt()
          const cancelCallback = useNfoPrompt.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <UseTmdbidFromFolderNamePrompt
        isOpen={tmdbPromptStore.isOpen}
        mediaName={tmdbPromptStore.mediaName}
        tmdbid={tmdbPromptStore.tmdbId}
        status={tmdbPromptStore.status ?? "ready"}
        onConfirm={() => {
          const currentStatus = tmdbPromptStore.status ?? "ready"
          if (currentStatus !== "ready") {
            return
          }

          tmdbPromptStore.closePrompt()
          
          const callback = tmdbPromptStore.onConfirm
          const tmdbId = tmdbPromptStore.tmdbId
          
          if (tmdbId !== undefined && tmdbId !== null && !isNaN(tmdbId) && typeof tmdbId === 'number' && callback) {
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
          }
        }}
        onCancel={() => {
          tmdbPromptStore.closePrompt()
          const cancelCallback = tmdbPromptStore.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <RuleBasedRenameFilePrompt
        isOpen={ruleBasedRenameFilePrompt.isOpen}
        namingRuleOptions={ruleBasedRenameFilePrompt.toolbarOptions || []}
        selectedNamingRule={ruleBasedRenameFilePrompt.selectedNamingRule || "plex"}
        onNamingRuleChange={(value) => {
          updateRuleBasedRenameFilePromptSelectedRule(value as "plex" | "emby")
          if (ruleBasedRenameFilePrompt.setSelectedNamingRule) {
            ruleBasedRenameFilePrompt.setSelectedNamingRule(value as "plex" | "emby")
          }
        }}
        onNamingRulesSelected={(value) => {
          if (ruleBasedRenameFilePrompt.onNamingRulesSelected) {
            ruleBasedRenameFilePrompt.onNamingRulesSelected(value as "plex" | "emby")
          }
        }}
        onConfirm={() => {
          const callback = ruleBasedRenameFilePrompt.onConfirm
          const planId = ruleBasedRenameFilePrompt.planId
          closeRuleBasedRenameFilePrompt()
          if (callback && planId) {
            callback(planId)
          }
        }}
        onCancel={() => {
          closeRuleBasedRenameFilePrompt()
          const cancelCallback = ruleBasedRenameFilePrompt.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <AiBasedRenameFilePrompt
        isOpen={aiBasedRenameFilePrompt.isOpen}
        status={aiBasedRenameFilePrompt.status || "generating"}
        onConfirm={() => {
          const callback = aiBasedRenameFilePrompt.onConfirm
          closeAiBasedRenameFilePrompt()
          if (callback) {
            callback()
          }
        }}
        onCancel={() => {
          closeAiBasedRenameFilePrompt()
          const cancelCallback = aiBasedRenameFilePrompt.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />

      <AiBasedRecognizePrompt
        isOpen={aiBasedRecognizePrompt.isOpen}
        status={aiBasedRecognizePrompt.status || "generating"}
        onConfirm={() => {
          const callback = aiBasedRecognizePrompt.onConfirm
          closeAiBasedRecognizePrompt()
          if (callback) {
            callback()
          }
        }}
        onCancel={() => {
          closeAiBasedRecognizePrompt()
          const cancelCallback = aiBasedRecognizePrompt.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
        confirmLabel={aiBasedRecognizePrompt.confirmButtonLabel || ""}
        isConfirmButtonDisabled={aiBasedRecognizePrompt.confirmButtonDisabled || false}
        isConfirmDisabled={aiBasedRecognizePrompt.isRenaming || false}
      />

      <RuleBasedRecognizePrompt
        isOpen={ruleBasedRecognizePrompt.isOpen}
        tvShowTitle={ruleBasedRecognizePrompt.tvShowTitle || ""}
        tvShowTmdbId={ruleBasedRecognizePrompt.tvShowTmdbId || -1}
        isLoading={isRuleBasedRecognizeLoading}
        isConfirmButtonDisabled={isRuleBasedRecognizeLoading}
        onConfirm={async () => {
          const callback = ruleBasedRecognizePrompt.onConfirm
          const plan = ruleBasedPlan
          closeRuleBasedRecognizePrompt()
          
          if (callback && plan) {
            try {
              await callback(plan as UIRecognizeMediaFilePlan)
            } catch (error) {
              console.error('[TvShowPanelPrompts] Error in onConfirm:', error)
            }
          }
        }}
        onCancel={() => {
          closeRuleBasedRecognizePrompt()
          const cancelCallback = ruleBasedRecognizePrompt.onCancel
          if (cancelCallback) {
            cancelCallback()
          }
        }}
      />
    </div>
  )
}
