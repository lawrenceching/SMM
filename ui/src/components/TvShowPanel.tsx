import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"

function TvShowPanel() {
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadata()

  return (
    <div className='p-1 w-full h-full'>
        <TMDBTVShowOverview 
                tvShow={mediaMetadata?.tmdbTvShow} 
                className="w-full h-full"
              />
    </div>
  )
}

export default TvShowPanel