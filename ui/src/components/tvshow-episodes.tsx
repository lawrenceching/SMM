import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion"
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
  } from "@/components/ui/context-menu"
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import Image from "./Image";
import { cn } from "@/lib/utils";


export interface Episode {

    /**
     * The name of the episode
     */
    name: string;
    seasonNumber: number;
    episodeNumber: number;

    /**
     * could be base64 encoded image data (data:image/svg+xml;base64,... or data:image/svg+xml;base64,...), file path (file://), web URL (https://)
     */
    thumbnail?: string;

    /**
     * Absolute path of the video file, in POSIX format
     */
    videoFilePath?: File;
    
    /**
     * The associated files of the episode
     * For example:
     * - subtitle: subtitle file absolute path, in POSIX format
     * - audio: audio file absolute path, in POSIX format
     * - nfo: nfo file absolute path, in POSIX format
     */
    associatedFiles: File[];
}

export interface File {
    tag: "VID" | "SUB" | "AUD" | "NFO" | "POSTER" | "";
    /**
     * The relative path of the file, in POSIX format. Relative to the media folder.
     */
    path: string;
    /**
     * New path (or new file name) of the file, in POSIX format. Relative to the media folder.
     */
    newPath: string;
}

export interface Season {
    name: string;
    seasonNumber: number;
    episodes: Episode[];
}

interface EpisodeItemProps {
    episode: Episode;
    selected?: boolean;
    isEditing: boolean;
}

function EpisodeItem({ episode, selected = false, isEditing = false }: EpisodeItemProps) {

    const tag = useMemo(() => {

        if(episode.seasonNumber === undefined || episode.episodeNumber === undefined) {
            return "";
        }

        return `S${episode.seasonNumber}E${episode.episodeNumber}`;
    }, [episode.seasonNumber, episode.episodeNumber]);


    return (
        <div>

<ContextMenu>
  <ContextMenuTrigger>
    <div className={
        cn("flex items-center gap-2 hover:bg-primary/10",
        selected && "bg-primary/20"
     )}>
        <div>
            {
                episode.thumbnail && (
                    <Image
                        url={episode.thumbnail}
                        className="w-[150px] h-[80px]"
                    />
                )
            }
        </div>
        <div>
            <div> <span className="text-sm text-muted-foreground select-none p-1">{tag}</span> 
              {episode.name}
            </div>
            {
                episode.videoFilePath && (
                    <div className="text-sm text-muted-foreground"> 
                        <div>
                            <div className="text-sm text-muted-foreground select-none p-1 w-[60px] inline-block">{episode.videoFilePath.tag}</div> 
                            {episode.videoFilePath.path}
                        </div>
                        {
                            isEditing && (
                                <div>
                                    <div className="w-[60px] inline-block"><ArrowRight/></div>
                                    {episode.videoFilePath.newPath}
                                </div>
                            )
                        }
                    </div>
                )
            }
            {
                episode.associatedFiles.map((file, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                        <div>
                            <div className="text-sm text-muted-foreground select-none p-1 w-[60px] inline-block">{file.tag}</div>
                            {file.path}
                        </div>
                        {
                            isEditing && (
                                <div>
                                    <div className="w-[60px] inline-block"><ArrowRight/></div>
                                    {file.newPath}
                                </div>
                            )
                        }
                    </div>
                ))
            }
        </div>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Properties</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
            
        </div>
    )
}


export interface TvShowEpisodesProps {
    seasons: Season[];
    isEditing: boolean;
}

export function TvShowEpisodes({ seasons, isEditing }: TvShowEpisodesProps) {

    return (
        <div>

{
    seasons.map((season) => (
        <Accordion key={season.seasonNumber} type="single" collapsible defaultValue={season.name}>
            <AccordionItem value={season.name}>
                <AccordionTrigger>{season.name}</AccordionTrigger>
                <AccordionContent>
                    {season.episodes.map((episode, index) => (
                        <EpisodeItem key={index} episode={episode} isEditing={isEditing} />
                    ))}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    ))
}


        </div>
    )
}