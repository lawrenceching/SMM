import { useState, useEffect, useRef } from "react"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../../TvShowPanel"
import { buildFileProps } from "../../TvShowPanelUtils"
import { loadNfo } from "@/helpers/loadNfo"
import { usePromptsContext } from "../../TvShowPanelPrompts"

interface UseTvShowPanelStateParams {
  mediaMetadata: MediaMetadata | undefined
  toolbarOptions: Array<{ value: "plex" | "emby"; label: string }>
  usePrompts: {
    openUseNfoPrompt: (params: {
      nfoData: import("@core/types").TMDBTVShowDetails
      onConfirm?: (tmdbTvShow: import("@core/types").TMDBTVShow) => void
      onCancel?: () => void
    }) => void
  }
}

export function useTvShowPanelState({ mediaMetadata, toolbarOptions, usePrompts }: UseTvShowPanelStateParams) {
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [seasons, setSeasons] = useState<SeasonModel[]>([])
  const [isRenaming, setIsRenaming] = useState(false)
  const [scrollToEpisodeId, setScrollToEpisodeId] = useState<number | null>(null)
  const [aiBasedRenameFileStatus, setAiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack">("generating")

  const prevMediaFolderPathRef = useRef<string | undefined>(undefined)
  const processedMediaFolderPathRef = useRef<string | undefined>(undefined) // Track which folder we've already processed for inference
  const promptsContext = usePromptsContext()
  
  // Extract setters to avoid dependency on the whole context object
  const setIsUseNfoPromptOpen = promptsContext._setIsUseNfoPromptOpen
  const setLoadedNfoData = promptsContext.setLoadedNfoData
  const setIsUseTmdbidFromFolderNamePromptOpen = promptsContext._setIsUseTmdbidFromFolderNamePromptOpen
  const setTmdbIdFromFolderName = promptsContext._setTmdbIdFromFolderName
  const setTmdbMediaNameFromFolderName = promptsContext._setTmdbMediaNameFromFolderName
  
  // Store latest function reference in ref to avoid dependency issues
  const openUseNfoPromptRef = useRef(usePrompts.openUseNfoPrompt)
  useEffect(() => {
    openUseNfoPromptRef.current = usePrompts.openUseNfoPrompt
  }, [usePrompts.openUseNfoPrompt])

  // Close prompts when mediaMetadata instance changes (different media folder selected)
  useEffect(() => {
    const currentPath = mediaMetadata?.mediaFolderPath
    const prevPath = prevMediaFolderPathRef.current
    
    // If the path changed (different instance), close all prompts and reset processed path
    if (prevPath !== undefined && currentPath !== prevPath) {
      setIsUseNfoPromptOpen(false)
      setLoadedNfoData(undefined)
      setIsUseTmdbidFromFolderNamePromptOpen(false)
      setTmdbIdFromFolderName(undefined)
      setTmdbMediaNameFromFolderName(undefined)
      // Reset processed path so inference can run again for the new folder
      processedMediaFolderPathRef.current = undefined
    }
    
    // Update the ref with the current path
    prevMediaFolderPathRef.current = currentPath
  }, [mediaMetadata?.mediaFolderPath, setIsUseNfoPromptOpen, setLoadedNfoData, setIsUseTmdbidFromFolderNamePromptOpen, setTmdbIdFromFolderName, setTmdbMediaNameFromFolderName])

  // Build seasons state from media metadata
  useEffect(() => {
    if(mediaMetadata === undefined) {
      return;
    }

    // Only try to infer media type once per mediaFolderPath
    const currentPath = mediaMetadata.mediaFolderPath
    const hasProcessedThisPath = processedMediaFolderPathRef.current === currentPath
    
    if(mediaMetadata.tmdbTvShow === undefined && !hasProcessedThisPath) {
      console.log(`[useTvShowPanelState] trying to infer to media type`);
      // Mark this path as processed
      processedMediaFolderPathRef.current = currentPath
      
      if(mediaMetadata.files?.some(file => file.endsWith('/tvshow.nfo'))) {
        // Read NFO file before opening prompt
        loadNfo(mediaMetadata).then(tmdbTvShowDetails => {
          if (tmdbTvShowDetails !== undefined) {
            openUseNfoPromptRef.current({
              nfoData: tmdbTvShowDetails,
              // Callbacks will be set when opening from TvShowPanel
            })
          }
        })
      }
    }

    setSeasons(() => {
      if(!mediaMetadata) {
        return [];
      }

      if(mediaMetadata.tmdbTvShow?.seasons === undefined) {
        return [];
      }


      const newSeasons = mediaMetadata.tmdbTvShow.seasons.map(season => {
        return {
          season: season,
          episodes: season.episodes?.map(episode => {
            const files = buildFileProps(mediaMetadata, season.season_number, episode.episode_number);
            return {
              episode: episode,
              files: files
            };
          }) || []
        };
      });


      return newSeasons;
    })

  }, [mediaMetadata?.mediaFolderPath, mediaMetadata?.tmdbTvShow, mediaMetadata?.mediaFiles])

  // Reset scrollToEpisodeId after scrolling completes
  useEffect(() => {
    if (scrollToEpisodeId !== null) {
      const timeoutId = setTimeout(() => {
        setScrollToEpisodeId(null)
      }, 500) // Reset after scrolling animation completes (100ms delay + 400ms buffer)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [scrollToEpisodeId])

  return {
    seasons,
    setSeasons,
    selectedNamingRule,
    setSelectedNamingRule,
    aiBasedRenameFileStatus,
    setAiBasedRenameFileStatus,
    isRenaming,
    setIsRenaming,
    scrollToEpisodeId,
    setScrollToEpisodeId,
  }
}
