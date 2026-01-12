import { useState, useEffect, useMemo, useRef } from "react"
import type { TMDBTVShowDetails } from "@core/types"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../../TvShowPanel"
import { buildFileProps } from "../../TvShowPanelUtils"
import { loadNfo } from "@/helpers/loadNfo"

interface UseTvShowPanelStateParams {
  mediaMetadata: MediaMetadata | undefined
  toolbarOptions: Array<{ value: "plex" | "emby"; label: string }>
}

export function useTvShowPanelState({ mediaMetadata, toolbarOptions }: UseTvShowPanelStateParams) {
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [seasons, setSeasons] = useState<SeasonModel[]>([])
  const [isRenaming, setIsRenaming] = useState(false)
  const [scrollToEpisodeId, setScrollToEpisodeId] = useState<number | null>(null)
  const [isRuleBasedRenameFilePromptOpen, setIsRuleBasedRenameFilePromptOpen] = useState(false)
  const [isAiBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen] = useState(false)
  const [aiBasedRenameFileStatus, setAiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack">("generating")
  const [isRuleBasedRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen] = useState(false)
  const [isUseNfoPromptOpen, setIsUseNfoPromptOpen] = useState(false)
  const [loadedNfoData, setLoadedNfoData] = useState<TMDBTVShowDetails | undefined>(undefined)

  // Replace global seasonsBackup with useRef
  const seasonsBackup = useRef<SeasonModel[]>([])
  const prevMediaFolderPathRef = useRef<string | undefined>(undefined)

  // Close UseNfoPrompt when mediaMetadata instance changes (different media folder selected)
  useEffect(() => {
    const currentPath = mediaMetadata?.mediaFolderPath
    const prevPath = prevMediaFolderPathRef.current
    
    // If the path changed (different instance), close the prompt
    if (prevPath !== undefined && currentPath !== prevPath) {
      setIsUseNfoPromptOpen(false)
      setLoadedNfoData(undefined)
    }
    
    // Update the ref with the current path
    prevMediaFolderPathRef.current = currentPath
  }, [mediaMetadata?.mediaFolderPath])

  // Build seasons state from media metadata
  useEffect(() => {
    if(mediaMetadata === undefined) {
      return;
    }

    if(mediaMetadata.tmdbTvShow === undefined) {
      console.log(`[TvShowPanel] trying to infer to media type`);
      if(mediaMetadata.files?.some(file => file.endsWith('/tvshow.nfo'))) {
        // Read NFO file before opening prompt
        loadNfo(mediaMetadata).then(tmdbTvShowDetails => {
          if (tmdbTvShowDetails !== undefined) {
            setLoadedNfoData(tmdbTvShowDetails)
            setIsUseNfoPromptOpen(true)
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

      console.log(`[TvShowPanel] building seasons state from media metadata`)

      return mediaMetadata.tmdbTvShow.seasons.map(season => ({
        season: season,
        episodes: season.episodes?.map(episode => ({
          episode: episode,
          files: buildFileProps(mediaMetadata, season.season_number, episode.episode_number)
        })) || []
      }))
    })

  }, [mediaMetadata])

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

  // Calculate preview mode
  const isPreviewMode = useMemo(() => {
    return isAiBasedRenameFilePromptOpen || isRuleBasedRenameFilePromptOpen || isRuleBasedRecognizePromptOpen
  }, [isAiBasedRenameFilePromptOpen, isRuleBasedRenameFilePromptOpen, isRuleBasedRecognizePromptOpen])

  return {
    seasons,
    setSeasons,
    selectedNamingRule,
    setSelectedNamingRule,
    isRuleBasedRenameFilePromptOpen,
    setIsRuleBasedRenameFilePromptOpen,
    isAiBasedRenameFilePromptOpen,
    setIsAiBasedRenameFilePromptOpen,
    aiBasedRenameFileStatus,
    setAiBasedRenameFileStatus,
    isRuleBasedRecognizePromptOpen,
    setIsRuleBasedRecognizePromptOpen,
    isUseNfoPromptOpen,
    setIsUseNfoPromptOpen,
    loadedNfoData,
    setLoadedNfoData,
    isRenaming,
    setIsRenaming,
    scrollToEpisodeId,
    setScrollToEpisodeId,
    seasonsBackup,
    isPreviewMode,
  }
}
