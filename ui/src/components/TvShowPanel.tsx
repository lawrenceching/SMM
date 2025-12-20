import { useState, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { FileList } from "./FileList"
import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { TvShowEpisodes } from "./tvshow-episodes"
import { buildTvShowEpisodesPropsFromMediaMetadata, downloadThumbnail } from "@/lib/utils"
import { useMediaMetadata } from "./media-metadata-provider"
import { useDialogs } from "./dialog-provider"
import { useConfig } from "./config-provider"
import { getTvShowById } from "@/api/tmdb"
import { RenameRules, type MediaMetadata } from "@core/types"
import { toast } from "sonner"

function TvShowPanel() {
  const { selectedMediaMetadata: mediaMetadata, addMediaMetadata } = useMediaMetadata()
  const { mediaSearchDialog } = useDialogs()
  const [openMediaSearch] = mediaSearchDialog
  const { userConfig } = useConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedRenameRuleName] = useState<string | undefined>('Plex(TvShow/Anime)')

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
  }, [mediaMetadata])

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

  return (
    <div className='p-1 w-full h-full'>
        <div>
           <Button onClick={() => setIsEditing(!isEditing)}>Rename</Button>
           <Button onClick={handleScrapeButtonClick}>Scrape</Button>
        </div>
        <Tabs defaultValue="overall" className="w-full h-full">
        <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="tvshow">Tv Show</TabsTrigger>
            <TabsTrigger value="filess">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="overall" className="w-full h-full" >   
            {isLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-muted-foreground">Loading TV show details...</div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center w-full h-full gap-4">
                <div className="text-destructive">{error}</div>
                <Button variant="outline" onClick={handleOpenMediaSearch}>
                  <Search className="size-4 mr-2" />
                  Search Again
                </Button>
              </div>
            ) : (
              <TMDBTVShowOverview 
                tvShow={mediaMetadata?.tmdbTvShow} 
                className="w-full h-full"
                onOpenMediaSearch={handleOpenMediaSearch}
              />
            )}
        </TabsContent>
        <TabsContent value="tvshow">
          <TvShowEpisodes seasons={tvShowEpisodesProps.seasons} isEditing={isEditing} />
        </TabsContent>
        <TabsContent value="filess">
            <FileList files={mediaMetadata?.files ?? []} />
        </TabsContent>
        </Tabs>
    </div>
  )
}

export default TvShowPanel