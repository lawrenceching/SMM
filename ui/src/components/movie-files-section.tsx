import type { TMDBMovie } from "@core/types"
import { FileVideo, FileText, Music, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { FileProps } from "@/lib/types"
import { EpisodeFile } from "./episode-file"
import { useMemo } from "react"
import type { MovieFileModel } from "./MoviePanel"

// Helper function to get file icon based on extension
function getFileIcon(path: string) {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['srt', 'vtt', 'ass', 'ssa'].includes(ext || '')) return FileText
    if (['mp3', 'aac', 'flac', 'wav'].includes(ext || '')) return Music
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return ImageIcon
    return FileVideo
}

// Helper function to get icon and label for file type
function getFileTypeConfig(type: FileProps['type']): { icon: typeof FileVideo, label: string, iconColor: string } {
    switch (type) {
        case "video":
            return { icon: FileVideo, label: "Video File", iconColor: "text-primary" }
        case "subtitle":
            return { icon: FileText, label: "Subtitle Files", iconColor: "text-blue-500" }
        case "audio":
            return { icon: Music, label: "Audio Files", iconColor: "text-green-500" }
        case "nfo":
            return { icon: FileText, label: "NFO Files", iconColor: "text-muted-foreground" }
        case "poster":
            return { icon: ImageIcon, label: "Poster Files", iconColor: "text-muted-foreground" }
        case "file":
        default:
            return { icon: FileVideo, label: "Files", iconColor: "text-muted-foreground" }
    }
}

interface MovieFilesSectionProps {
    movie?: TMDBMovie
    isUpdatingMovie: boolean
    isPreviewMode: boolean
    movieFiles: MovieFileModel
}

export function MovieFilesSection({
    movie,
    isUpdatingMovie,
    isPreviewMode,
    movieFiles,
}: MovieFilesSectionProps) {
    // Group files by type
    const filesByType = useMemo(() => {
        const grouped = new Map<FileProps['type'], FileProps[]>()
        movieFiles.files.forEach(file => {
            const existing = grouped.get(file.type) || []
            grouped.set(file.type, [...existing, file])
        })
        return grouped
    }, [movieFiles.files])
    
    // Convert Map to array of entries for rendering
    const filesByTypeArray = useMemo(() => {
        return Array.from(filesByType.entries()) as Array<[FileProps['type'], FileProps[]]>
    }, [filesByType])

    if (isUpdatingMovie) {
        return (
            <div className="space-y-2 mt-6">
                <Skeleton className="h-6 w-24" />
                <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        )
    }

    if (!movie || movieFiles.files.length === 0) {
        return null
    }

    return (
        <div className="space-y-2 mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileVideo className="size-5" />
                Files ({movieFiles.files.length})
            </h2>
            <div className="space-y-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="p-4">
                        <div className="space-y-2">
                            {filesByTypeArray.map(([type, typeFiles]) => {
                                const { icon: TypeIcon, label, iconColor } = getFileTypeConfig(type)
                                const isVideo = type === "video"
                                const isMultiple = typeFiles.length > 1
                                
                                return (
                                    <div key={type} className="space-y-1">
                                        {isMultiple && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <TypeIcon className={cn("size-4", iconColor)} />
                                                <span className="text-xs font-semibold">{label} ({typeFiles.length})</span>
                                            </div>
                                        )}
                                        {typeFiles.map((file, index) => {
                                            const Icon = isVideo ? TypeIcon : getFileIcon(file.path)
                                            return (
                                                <EpisodeFile
                                                    key={`${type}-${index}-${file.path}`}
                                                    file={file}
                                                    icon={Icon}
                                                    label={isVideo && !isMultiple ? label : ""}
                                                    iconColor={isVideo ? iconColor : "text-muted-foreground"}
                                                    isPreviewMode={isPreviewMode}
                                                    showRenameMenu={isVideo}
                                                />
                                            )
                                        })}
                                    </div>
                                )
                            })}
                            
                            {/* No files message */}
                            {movieFiles.files.length === 0 && (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    No files associated with this movie
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
