import { useState, useEffect, useRef } from "react"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { SeasonModel } from "../TvShowPanel"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"

interface UseTvShowPanelStateParams {
  mediaMetadata: UIMediaMetadata | undefined
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
  const closeAllPrompts = useTvShowPromptsStore((state) => state.closeAllPrompts)
  
  // Store latest function reference in ref to avoid dependency issues
  const openUseNfoPromptRef = useRef(usePrompts.openUseNfoPrompt)
  useEffect(() => {
    openUseNfoPromptRef.current = usePrompts.openUseNfoPrompt
  }, [usePrompts.openUseNfoPrompt])

  // When media folder path changes: close prompts and reset processed path. Do NOT clear seasons here -
  // TvShowPanel uses seasonsPathRef to pass table data only when path matches, so clearing would race
  // with handleMediaFolderSelected's setSeasons and can overwrite the new folder's data if this effect runs after.
  useEffect(() => {
    const currentPath = mediaMetadata?.mediaFolderPath
    const prevPath = prevMediaFolderPathRef.current

    console.log("[useTvShowPanelState] path effect", {
      prevPath: prevPath ?? "(undefined)",
      currentPath: currentPath ?? "(undefined)",
      pathChanged: prevPath !== undefined && currentPath !== prevPath,
    })

    if (prevPath !== undefined && currentPath !== prevPath) {
      console.log("[useTvShowPanelState] path changed -> close prompts, reset processed path")
      closeAllPrompts()
      processedMediaFolderPathRef.current = undefined
    }

    prevMediaFolderPathRef.current = currentPath
  }, [mediaMetadata?.mediaFolderPath, closeAllPrompts])


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
