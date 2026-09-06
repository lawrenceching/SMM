import { UseNfoPrompt } from "./UseNfoPrompt"
import { AiBasedRenameEpisodePrompt } from "./AiBasedRenameEpisodePrompt"
import { AiBasedRecognizeEpisodePrompt } from "./AiBasedRecognizeEpisodePrompt"
import type { TMDBTVShow } from "@smm/types"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowAppPlanPrompts } from "./plans/TvShowAppPlanPromptContext"

export function TvShowPanelPrompts() {
  const {
    aiRenamePlan,
    aiRenamePromptStatus,
    aiRecognizePlan,
    aiRecognizePromptStatus,
    onAiRenameConfirm,
    onAiRenameCancel,
    onAiRecognizeConfirm,
    onAiRecognizeCancel,
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

      <AiBasedRenameEpisodePrompt
        isOpen={aiRenamePlan !== undefined}
        status={aiRenamePromptStatus}
        onConfirm={async () => {
          await onAiRenameConfirm()
        }}
        onCancel={() => {
          void onAiRenameCancel()
        }}
      />

      <AiBasedRecognizeEpisodePrompt
        isOpen={aiRecognizePlan !== undefined}
        status={aiRecognizePromptStatus}
        onConfirm={() => {
          void onAiRecognizeConfirm()
        }}
        onCancel={() => {
          void onAiRecognizeCancel()
        }}
      />
    </div>
  )
}
