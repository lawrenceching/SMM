import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { FloatingToolbar } from "./FloatingToolbar"
import { useState } from "react"

function TvShowPanel() {
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadata()
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const toolbarOptions = [
    { value: "Plex", label: "Plex" },
  ]
  const [selectedOption, setSelectedOption] = useState(toolbarOptions[0]?.value || "")

  return (
    <div className='p-1 w-full h-full relative'>
      <FloatingToolbar 
        isOpen={isToolbarOpen}
        options={toolbarOptions}
        selectedValue={selectedOption}
        onValueChange={setSelectedOption}
        onConfirm={() => {
          console.log("Confirm clicked")
          setIsToolbarOpen(false)
        }}
        onCancel={() => {
          console.log("Cancel clicked")
          setIsToolbarOpen(false)
        }}
      />
      <div className="w-full h-full">
        <TMDBTVShowOverview 
          tvShow={mediaMetadata?.tmdbTvShow} 
          className="w-full h-full"
          onRenameClick={() => setIsToolbarOpen(true)}
        />
      </div>
    </div>
  )
}

export default TvShowPanel