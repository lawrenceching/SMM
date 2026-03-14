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

export function TvShowPanelPrompts() {
  const tmdbPromptStore = useTmdbIdFromFolderNamePromptStore()
  const pendingPlans = usePlansStore((state) => state.pendingPlans)

  const useNfoPrompt = useTvShowPromptsStore((state) => state.useNfoPrompt)
  const ruleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
  const aiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const aiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
  const ruleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)

  const ruleBasedPlan = ruleBasedRecognizePrompt.planId
    ? pendingPlans.find((p) => p.id === ruleBasedRecognizePrompt.planId)
    : undefined
  const isRuleBasedRecognizeLoading = ruleBasedPlan?.status === 'loading'
  
  const closeUseNfoPrompt = useTvShowPromptsStore((state) => state.closeUseNfoPrompt)
  const closeRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeRuleBasedRenameFilePrompt)
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
          console.log('[TvShowPanelPrompts] UseNfoPrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasNfoData: !!useNfoPrompt.data,
            nfoDataId: useNfoPrompt.data?.id,
            hasCallback: !!useNfoPrompt.onConfirm
          })
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
          console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            status: tmdbPromptStore.status ?? "ready",
            tmdbId: tmdbPromptStore.tmdbId,
            stackTrace: new Error().stack
          })
          const currentStatus = tmdbPromptStore.status ?? "ready"
          if (currentStatus !== "ready") {
            console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt onConfirm BLOCKED - status not ready', {
              timestamp: new Date().toISOString(),
              currentStatus
            })
            return
          }

          tmdbPromptStore.closePrompt()
          
          const callback = tmdbPromptStore.onConfirm
          const tmdbId = tmdbPromptStore.tmdbId
          
          if (tmdbId !== undefined && tmdbId !== null && !isNaN(tmdbId) && typeof tmdbId === 'number' && callback) {
            console.log('[TvShowPanelPrompts] UseTmdbidFromFolderNamePrompt INVOKING callback', {
              timestamp: new Date().toISOString(),
              tmdbId,
              callbackType: typeof callback
            })
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
          if (ruleBasedRenameFilePrompt.setSelectedNamingRule) {
            ruleBasedRenameFilePrompt.setSelectedNamingRule(value as "plex" | "emby")
          }
        }}
        onConfirm={() => {
          console.log('[TvShowPanelPrompts] RuleBasedRenameFilePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!ruleBasedRenameFilePrompt.onConfirm,
            stackTrace: new Error().stack
          })
          const callback = ruleBasedRenameFilePrompt.onConfirm
          closeRuleBasedRenameFilePrompt()
          if (callback) {
            console.log('[TvShowPanelPrompts] RuleBasedRenameFilePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
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
          console.log('[TvShowPanelPrompts] AiBasedRenameFilePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!aiBasedRenameFilePrompt.onConfirm,
            status: aiBasedRenameFilePrompt.status,
            stackTrace: new Error().stack
          })
          const callback = aiBasedRenameFilePrompt.onConfirm
          closeAiBasedRenameFilePrompt()
          if (callback) {
            console.log('[TvShowPanelPrompts] AiBasedRenameFilePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
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
          console.log('[TvShowPanelPrompts] AiBasedRecognizePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!aiBasedRecognizePrompt.onConfirm,
            status: aiBasedRecognizePrompt.status,
            stackTrace: new Error().stack
          })
          const callback = aiBasedRecognizePrompt.onConfirm
          closeAiBasedRecognizePrompt()
          if (callback) {
            console.log('[TvShowPanelPrompts] AiBasedRecognizePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
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
        onConfirm={() => {
          console.log('[TvShowPanelPrompts] RuleBasedRecognizePrompt onConfirm TRIGGERED', {
            timestamp: new Date().toISOString(),
            hasCallback: !!ruleBasedRecognizePrompt.onConfirm,
            stackTrace: new Error().stack
          })
          const callback = ruleBasedRecognizePrompt.onConfirm
          closeRuleBasedRecognizePrompt()
          if (callback) {
            console.log('[TvShowPanelPrompts] RuleBasedRecognizePrompt INVOKING callback', {
              timestamp: new Date().toISOString()
            })
            callback()
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
