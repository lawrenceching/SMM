import { UseNfoPrompt } from "./UseNfoPrompt"
import { RuleBasedRenameFilePrompt } from "../RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import type { TMDBTVShow } from "@core/types"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { useFeatures } from "@/hooks/useFeatures"
import { useTvShowAppPlanPrompts } from "./plans/TvShowAppPlanPromptContext"

export function TvShowPanelPrompts() {
  const { isAiFeatureEnabled } = useFeatures()

  const {
    appRenamePlan,
    appRecognizePlan,
    renameToolbarOptions,
    selectedNamingRule,
    setSelectedNamingRule,
    onAppRenameNamingRuleSelected,
    onAppRenameConfirm,
    onAppRenameCancel,
    onAppRecognizeConfirm,
    onAppRecognizeCancel,
    tvShowTitle,
    tvShowTmdbId,
    isRuleBasedRecognizeLoading,
    notAllEpisodesRecognized,
    allPlanFilesUnchanged,
  } = useTvShowAppPlanPrompts()

  const closeUseNfoPrompt = useTvShowPromptsStore((state) => state.closeUseNfoPrompt)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)

  const useNfoPrompt = useTvShowPromptsStore((state) => state.useNfoPrompt)
  const aiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const aiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)

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
              media_type: "tv",
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

      <RuleBasedRenameFilePrompt
        isOpen={appRenamePlan !== undefined}
        namingRuleOptions={renameToolbarOptions}
        selectedNamingRule={selectedNamingRule}
        onNamingRuleChange={(value) => {
          setSelectedNamingRule(value as "plex" | "emby")
        }}
        onNamingRulesSelected={(value) => {
          void onAppRenameNamingRuleSelected(value as "plex" | "emby")
        }}
        onConfirm={async () => {
          if (appRenamePlan) {
            await onAppRenameConfirm(appRenamePlan.id)
          }
        }}
        onCancel={async () => {
          if (appRenamePlan) {
            await onAppRenameCancel(appRenamePlan.id)
          }
        }}
      />

      {isAiFeatureEnabled && (
        <AiBasedRenameFilePrompt
          isOpen={aiBasedRenameFilePrompt.isOpen}
          status={aiBasedRenameFilePrompt.status || "generating"}
          onConfirm={async () => {
            const callback = aiBasedRenameFilePrompt.onConfirm
            closeAiBasedRenameFilePrompt()
            if (callback) {
              await callback()
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
      )}

      {isAiFeatureEnabled && (
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
      )}

      <RuleBasedRecognizePrompt
        isOpen={appRecognizePlan !== undefined}
        tvShowTitle={tvShowTitle}
        tvShowTmdbId={tvShowTmdbId}
        isLoading={isRuleBasedRecognizeLoading}
        notAllEpisodesRecognized={notAllEpisodesRecognized}
        allPlanFilesUnchanged={allPlanFilesUnchanged}
        isConfirmButtonDisabled={isRuleBasedRecognizeLoading}
        onConfirm={async () => {
          if (appRecognizePlan) {
            await onAppRecognizeConfirm(appRecognizePlan as UIRecognizeMediaFilePlan)
          }
        }}
        onCancel={async () => {
          if (appRecognizePlan) {
            await onAppRecognizeCancel(appRecognizePlan.id)
          }
        }}
      />
    </div>
  )
}
