import { UseNfoPrompt } from "./UseNfoPrompt"
import type { TMDBTVShow } from "@smm/types"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"

export function TvShowPanelPrompts() {
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
    </div>
  )
}
