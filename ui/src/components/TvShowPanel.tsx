import { useState, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { TvShowEpisodes } from "./tvshow-episodes"
import { buildTvShowEpisodesPropsFromMediaMetadata, downloadThumbnail } from "@/lib/utils"
import { useMediaMetadata } from "./media-metadata-provider"
import { useDialogs } from "./dialog-provider"
import { useConfig } from "./config-provider"
import { getTvShowById } from "@/api/tmdb"
import { RenameRules, type MediaMetadata } from "@core/types"
import { toast } from "sonner"
import LocalFilesPanel from "./LocalFilesPanel"
import { RenameRuleCombobox } from "./rename-rules-combobox"

function TvShowPanel() {
  const { selectedMediaMetadata: mediaMetadata, addMediaMetadata } = useMediaMetadata()
  const { mediaSearchDialog } = useDialogs()
  const [openMediaSearch] = mediaSearchDialog
  const { userConfig } = useConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedRenameRuleName, setSelectedRenameRuleName] = useState<string | undefined>('Plex(TvShow/Anime)')
  // const [isInRenameStatus, setIsInRenameStatus] = useState(true)

  const handleTmdbIdSelect = async (tmdbId: number) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'
      const response = await getTvShowById(tmdbId, language)
      
      if (response.error) {
        setError(response.error)
      } else if (response.data) {
        setError(null)
        
        // Update mediaMetadata to persist TV show details
        if (mediaMetadata) {
          const updatedMetadata: MediaMetadata = {
            ...mediaMetadata,
            tmdbTvShow: response.data,
            tmdbTVShowId: response.data.id, // Keep for backward compatibility
            tmdbMediaType: 'tv',
          }
          
          // Persist to file and update state
          console.log(`[TvShowPanel] Persisting TV show details to media metadata: `, updatedMetadata)
          addMediaMetadata(updatedMetadata)
        }
      }
    } catch (err) {
      console.error('Failed to fetch TV show:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch TV show')
    } finally {
      setIsLoading(false)
    }
  }

  // Open media search with callback
  const handleOpenMediaSearch = () => {
    openMediaSearch(handleTmdbIdSelect)
  }

  // Build TvShowEpisodesProps from mediaMetadata
  const tvShowEpisodesProps = useMemo(() => {
    const selectedRenameRule = selectedRenameRuleName ? Object.values(RenameRules).find(rule => rule.name === selectedRenameRuleName) : undefined
    return buildTvShowEpisodesPropsFromMediaMetadata(mediaMetadata, selectedRenameRule)
  }, [mediaMetadata, selectedRenameRuleName])

  const handleScrapeButtonClick = useCallback(() => {
    if(!mediaMetadata) {
      return;
    }

    if(!mediaMetadata.tmdbTvShow) {
      return;
    }

    if(mediaMetadata.mediaFiles) {
      const promises = mediaMetadata.mediaFiles.map(mediaFile => {
        return downloadThumbnail(mediaMetadata, mediaFile)
      })
  
      Promise.all(promises).then(() => {
        toast.success('封面刮削成功')
      }).catch((error) => {
        toast.error(`刮削封面因未知原因失败: ${error.message}`)
      })
    }

  }, [mediaMetadata])

  const handleRenameRuleChange = (renameRuleName: string) => {
    setSelectedRenameRuleName(renameRuleName)
  }

  return (
    <div className='p-1 w-full h-full'>
        <TMDBTVShowOverview 
                tvShow={mediaMetadata?.tmdbTvShow} 
                className="w-full h-full"
                onOpenMediaSearch={handleOpenMediaSearch}
              />
    </div>
  )
}

export default TvShowPanel