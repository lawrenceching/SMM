import type { TMDBTVShowDetails } from "@core/types"
import { ChevronDown, Play, FileVideo, FileText, Music, Image as ImageIcon, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FileProps } from "@/lib/types"
import { EpisodeFile } from "./episode-file"
import { newFileName } from "@/api/newFileName"
import { useEffect, useState } from "react"
import { useMediaMetadata } from "./media-metadata-provider"
import { join } from "@/lib/path"
import React from "react"

// Helper function to format date
function formatDate(dateString: string): string {
    if (!dateString) return "N/A"
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    } catch {
        return dateString
    }
}

// Helper function to get TMDB image URL
function getTMDBImageUrl(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string | null {
    if (!path) return null
    const baseUrl = "https://image.tmdb.org/t/p"
    return `${baseUrl}/${size}${path}`
}

// Helper function to get file icon based on extension
function getFileIcon(path: string) {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['srt', 'vtt', 'ass', 'ssa'].includes(ext || '')) return FileText
    if (['mp3', 'aac', 'flac', 'wav'].includes(ext || '')) return Music
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return ImageIcon
    return FileVideo
}



interface EpisodeSectionProps {
    episode: NonNullable<NonNullable<TMDBTVShowDetails['seasons']>[number]['episodes']>[number]
    expandedEpisodeIds: Set<number>
    setExpandedEpisodeIds: React.Dispatch<React.SetStateAction<Set<number>>>
    /**
     * files of the episode, which holds:
     * * video file
     * * subtitle files
     * * audio files
     * * nfo files
     * * poster files
     * * other files that may supported in the future
     */
    files: FileProps[]

    /**
     * If true, the episode section display the new path which user to preview
     */
    isPreviewMode: boolean
    ruleName?: "plex"
    seasonNumber: number
    tvshowName: string
    tmdbId: string
    releaseYear: string
}

export function EpisodeSection({
    episode,
    expandedEpisodeIds,
    setExpandedEpisodeIds,
    files,
    isPreviewMode,
    ruleName,
    seasonNumber,
    tvshowName,
    tmdbId,
    releaseYear,
}: EpisodeSectionProps) {
    const { selectedMediaMetadata } = useMediaMetadata()    
    const episodeStillUrl = getTMDBImageUrl(episode.still_path, "w300")
    const isEpisodeExpanded = expandedEpisodeIds.has(episode.id)
    
    // Extract files by type from files prop
    const videoFile = files.find(file => file.type === "video")
    const subtitleFiles = files.filter(file => file.type === "subtitle")
    const audioFiles = files.filter(file => file.type === "audio")
    
    // State to store generated file names
    const [generatedFileNames, setGeneratedFileNames] = useState<Map<string, string>>(new Map())
    
    // Generate new file names when isPreviewMode is enabled and ruleName is provided
    useEffect(() => {
        if (!isPreviewMode || !ruleName || !videoFile) {
            setGeneratedFileNames(new Map())
            return
        }
        
        const generateFileName = async () => {
            try {
                const response = await newFileName({
                    ruleName: ruleName,
                    type: "tv",
                    seasonNumber: seasonNumber,
                    episodeNumber: episode.episode_number,
                    episodeName: episode.name || "",
                    tvshowName: tvshowName,
                    file: videoFile.path,
                    tmdbId: tmdbId,
                    releaseYear: releaseYear,
                })
                
                if (response.data) {
                    const relativePath = response.data
                    setGeneratedFileNames(new Map([[videoFile.path, join(selectedMediaMetadata!.mediaFolderPath!, relativePath)]]))
                }
            } catch (error) {
                console.error("Failed to generate file name:", error)
                setGeneratedFileNames(new Map())
            }
        }
        
        generateFileName()
    }, [isPreviewMode, ruleName, videoFile?.path, seasonNumber, episode.episode_number, episode.name, tvshowName, tmdbId, releaseYear])
    
    // Update files with generated new paths
    const filesWithNewPaths = files.map(file => {
        if (file.type === "video" && generatedFileNames.has(file.path)) {
            return {
                ...file,
                newPath: generatedFileNames.get(file.path) || file.newPath
            }
        }
        return file
    })
    
    const videoFileWithNewPath = filesWithNewPaths.find(file => file.type === "video")
    
    return (
        <div className="rounded-md bg-background border overflow-hidden transition-all">
            <div
                onClick={() => {
                    if (isPreviewMode) return // Don't allow collapse in preview mode
                    setExpandedEpisodeIds(prev => {
                        const newSet = new Set(prev)
                        if (isEpisodeExpanded) {
                            newSet.delete(episode.id)
                        } else {
                            newSet.add(episode.id)
                        }
                        return newSet
                    })
                }}
                className="flex gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer"
            >
                {episodeStillUrl ? (
                    <div className="shrink-0">
                        <img
                            src={episodeStillUrl}
                            alt={episode.name}
                            className="w-32 h-20 object-cover rounded-md bg-muted"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                            }}
                        />
                    </div>
                ) : (
                    <div className="shrink-0 w-32 h-20 rounded-md bg-muted flex items-center justify-center">
                        <Play className="size-6 text-muted-foreground/50" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                                E{episode.episode_number.toString().padStart(2, '0')}
                            </span>
                            <h4 className="font-semibold text-sm">
                                {episode.name}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {episode.vote_average > 0 && (
                                <div className="flex items-center gap-1">
                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                    <span className="text-xs text-muted-foreground">
                                        {episode.vote_average.toFixed(1)}
                                    </span>
                                </div>
                            )}
                            <ChevronDown 
                                className={cn(
                                    "size-4 text-muted-foreground transition-transform",
                                    isEpisodeExpanded && "transform rotate-180"
                                )}
                            />
                        </div>
                    </div>
                    {episode.air_date && (
                        <p className="text-xs text-muted-foreground mb-1">
                            {formatDate(episode.air_date)}
                        </p>
                    )}
                    {episode.runtime > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                            {episode.runtime} min
                        </p>
                    )}
                    {episode.overview && (
                        <p className={cn(
                            "text-xs text-muted-foreground",
                            !isEpisodeExpanded && "line-clamp-2"
                        )}>
                            {episode.overview}
                        </p>
                    )}
                </div>
            </div>
            
            {/* Files - Expandable */}
            {isEpisodeExpanded && (
                <div className="px-3 pb-3 border-t bg-muted/20">
                    <div className="pt-3 space-y-2">
                        {/* Video File */}
                        {(videoFileWithNewPath || videoFile) && (
                            <EpisodeFile
                                file={videoFileWithNewPath || videoFile!}
                                icon={FileVideo}
                                label="Video File"
                                iconColor="text-primary"
                                isPreviewMode={isPreviewMode}
                                showRenameMenu={true}
                            />
                        )}
                        
                        {/* Subtitle Files */}
                        {subtitleFiles.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className="size-4 text-blue-500" />
                                    <span className="text-xs font-semibold">Subtitle Files ({subtitleFiles.length})</span>
                                </div>
                                {subtitleFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.path)
                                    return (
                                        <EpisodeFile
                                            key={index}
                                            file={file}
                                            icon={Icon}
                                            label=""
                                            iconColor="text-muted-foreground"
                                            isPreviewMode={isPreviewMode}
                                            showRenameMenu={false}
                                        />
                                    )
                                })}
                            </div>
                        )}
                        
                        {/* Audio Files */}
                        {audioFiles.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Music className="size-4 text-green-500" />
                                    <span className="text-xs font-semibold">Audio Files ({audioFiles.length})</span>
                                </div>
                                {audioFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.path)
                                    return (
                                        <EpisodeFile
                                            key={index}
                                            file={file}
                                            icon={Icon}
                                            label=""
                                            iconColor="text-muted-foreground"
                                            isPreviewMode={isPreviewMode}
                                            showRenameMenu={false}
                                        />
                                    )
                                })}
                            </div>
                        )}
                        
                        {/* No files message */}
                        {!videoFile && subtitleFiles.length === 0 && audioFiles.length === 0 && (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                                No files associated with this episode
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

