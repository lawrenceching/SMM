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
}

interface FileItem {
    tag: "VID" | "SUB" | "AUD" | "NFO";
    /**
     * Relative path of media folder, in POSIX format
     */
    path: string;
}

function EpisodeItem({ episode, selected = false }: EpisodeItemProps) {

    const tag = useMemo(() => {

        if(episode.seasonNumber === undefined || episode.episodeNumber === undefined) {
            return "";
        }

        return `S${episode.seasonNumber}E${episode.episodeNumber}`;
    }, [episode.seasonNumber, episode.episodeNumber]);

    const associatedFiles: FileItem[] = useMemo(() => {

        if(episode.associatedFiles === undefined) {
            return [];
        }

        return episode.associatedFiles.map((file) => {
            return {
                tag: file.tag as "VID" | "SUB" | "AUD" | "NFO",
                path: file.path,
            } as FileItem;
        });
    }, [episode.associatedFiles]);

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
                        <span className="text-sm text-muted-foreground select-none p-1">{episode.videoFilePath.tag}</span> 
                        {episode.videoFilePath.path}
                    </div>
                )
            }
            {
                associatedFiles.map((file, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                        <span className="text-sm text-muted-foreground select-none p-1">{file.tag}</span>
                        {file.path}
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
}

export function TvShowEpisodes({ seasons }: TvShowEpisodesProps) {

    return (
        <div>

{
    seasons.map((season) => (
        <Accordion key={season.seasonNumber} type="single" collapsible defaultValue={season.name}>
            <AccordionItem value={season.name}>
                <AccordionTrigger>{season.name}</AccordionTrigger>
                <AccordionContent>
                    {season.episodes.map((episode, index) => (
                        <EpisodeItem key={index} episode={episode} />
                    ))}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    ))
}


        </div>
    )
}