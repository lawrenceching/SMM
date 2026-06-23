import { UseNfoPrompt } from "./UseNfoPrompt"
import { RuleBasedRenameFilePrompt } from "../RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import type { TMDBTVShow } from "@core/types"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { useTvShowAppPlanPrompts } from "./plans/TvShowAppPlanPromptContext"

export function TvShowPanelPrompts() {
  const {
    appRenamePlan,
    appRecognizePlan,
    aiRenamePlan,
    aiRenamePromptStatus,
    aiRecognizePlan,
    aiRecognizePromptStatus,
    renameToolbarOptions,
    selectedNamingRule,
    setSelectedNamingRule,
    onAppRenameNamingRuleSelected,
    onAppRenameConfirm,
    onAppRenameCancel,
    onAiRenameConfirm,
    onAiRenameCancel,
    onAiRecognizeConfirm,
    onAiRecognizeCancel,
    onAppRecognizeConfirm,
    onAppRecognizeCancel,
    tvShowTitle,
    tvShowTmdbId,
    isRuleBasedRecognizeLoading,
    notAllEpisodesRecognized,
    allPlanFilesUnchanged,
  } = useTvShowAppPlanPrompts()

  const closeUseNfoPrompt = useTvShowPromptsStore((state) => state.closeUseNfoPrompt)

  const useNfoPrompt = useTvShowPromptsStore((state) => state.useNfoPrompt)

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

      <AiBasedRenameFilePrompt
        isOpen={aiRenamePlan !== undefined}
        status={aiRenamePromptStatus}
        onConfirm={async () => {
          await onAiRenameConfirm()
        }}
        onCancel={() => {
          void onAiRenameCancel()
        }}
      />

      <AiBasedRecognizePrompt
        isOpen={aiRecognizePlan !== undefined}
        status={aiRecognizePromptStatus}
        onConfirm={() => {
          void onAiRecognizeConfirm()
        }}
        onCancel={() => {
          void onAiRecognizeCancel()
        }}
      />

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
