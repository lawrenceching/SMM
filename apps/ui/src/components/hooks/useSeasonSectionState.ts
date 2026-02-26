import { useState, useEffect, useRef } from "react"
import { usePromptsContext } from "../TvShowPanelPrompts"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

interface UseSeasonSectionStateParams {
  mediaMetadata: UIMediaMetadata | undefined
  scrollToEpisodeId?: number | null
}

export function useSeasonSectionState({ mediaMetadata, scrollToEpisodeId }: UseSeasonSectionStateParams) {
  const [expandedSeasonIds, setExpandedSeasonIds] = useState<Set<number>>(new Set())
  const [expandedEpisodeIds, setExpandedEpisodeIds] = useState<Set<number>>(new Set())
  
  const promptsContext = usePromptsContext()
  
  const isPreviewingForRename = 
    promptsContext.isAiBasedRenameFilePromptOpen ||
    promptsContext.isRuleBasedRenameFilePromptOpen ||
    promptsContext.isRuleBasedRecognizePromptOpen ||
    promptsContext.isAiRecognizePromptOpen
  
  const isPreviewingForRecognize = 
    promptsContext.isRuleBasedRecognizePromptOpen ||
    promptsContext.isAiRecognizePromptOpen
  
  const savedSeasonIdsRef = useRef<Set<number> | null>(null)
  const savedEpisodeIdsRef = useRef<Set<number> | null>(null)
  const prevPreviewModeRef = useRef(false)

  useEffect(() => {
    const wasInPreviewMode = prevPreviewModeRef.current
    prevPreviewModeRef.current = isPreviewingForRename

    if (isPreviewingForRename && !wasInPreviewMode && mediaMetadata?.tmdbTvShow?.seasons) {
      setExpandedSeasonIds(currentSeasonIds => {
        savedSeasonIdsRef.current = new Set(currentSeasonIds)
        const seasonIds = new Set(mediaMetadata.tmdbTvShow!.seasons!.map(season => season.id))
        return seasonIds
      })

      setExpandedEpisodeIds(currentEpisodeIds => {
        savedEpisodeIdsRef.current = new Set(currentEpisodeIds)
        const episodeIds = new Set<number>()
        mediaMetadata.tmdbTvShow!.seasons!.forEach(season => {
          if (season.episodes) {
            season.episodes.forEach(episode => {
              episodeIds.add(episode.id)
            })
          }
        })
        return episodeIds
      })
    } else if (!isPreviewingForRename && wasInPreviewMode && savedSeasonIdsRef.current !== null && savedEpisodeIdsRef.current !== null) {
      setExpandedSeasonIds(savedSeasonIdsRef.current)
      setExpandedEpisodeIds(savedEpisodeIdsRef.current)
      savedSeasonIdsRef.current = null
      savedEpisodeIdsRef.current = null
    }
  }, [isPreviewingForRename, mediaMetadata?.tmdbTvShow?.seasons])
  
  useEffect(() => {
    if (scrollToEpisodeId === null || scrollToEpisodeId === undefined || !mediaMetadata?.tmdbTvShow?.seasons) {
      return
    }

    let targetSeasonId: number | null = null
    for (const season of mediaMetadata.tmdbTvShow.seasons) {
      if (season.episodes) {
        const episode = season.episodes.find(ep => ep.id === scrollToEpisodeId)
        if (episode) {
          targetSeasonId = season.id
          break
        }
      }
    }

    if (targetSeasonId === null) {
      console.warn(`[useSeasonSectionState] Episode with ID ${scrollToEpisodeId} not found`)
      return
    }

    setExpandedSeasonIds(prev => {
      const newSet = new Set(prev)
      newSet.add(targetSeasonId!)
      return newSet
    })

    setExpandedEpisodeIds(prev => {
      const newSet = new Set(prev)
      newSet.add(scrollToEpisodeId!)
      return newSet
    })

    const timeoutId = setTimeout(() => {
      const episodeElement = document.querySelector(`[data-episode-id="${scrollToEpisodeId}"]`)
      if (episodeElement) {
        episodeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        })
      } else {
        console.warn(`[useSeasonSectionState] Episode element with ID ${scrollToEpisodeId} not found in DOM`)
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [scrollToEpisodeId, mediaMetadata?.tmdbTvShow?.seasons])
  
  return {
    expandedSeasonIds,
    setExpandedSeasonIds,
    expandedEpisodeIds,
    setExpandedEpisodeIds,
    isPreviewingForRename,
    isPreviewingForRecognize,
  }
}
