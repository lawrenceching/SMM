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
import { useMemo, useState } from "react";
import Image from "./Image";
import { cn } from "@/lib/utils";


interface Episode {

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
    videoFilePath: string;
    
    /**
     * The associated files of the episode
     * For example:
     * - subtitle: subtitle file absolute path, in POSIX format
     * - audio: audio file absolute path, in POSIX format
     * - nfo: nfo file absolute path, in POSIX format
     */
    associatedFiles: string[];
}

interface Season {
    name: string;
    seasonNumber: number;
    episodes: Episode[];
}

const episodes: Episode[] = [
    {
        name: "Episode 1",
        seasonNumber: 1,
        episodeNumber: 1,
        thumbnail: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzIwIDE4MCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiMxYTFhMWEiLz48Y2lyY2xlIGN4PSIxNjAiIGN5PSI5MCIgcj0iMzAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC45KSIvPjxwYXRoIGQ9Ik0xNTAgNzUgTDE1MCAxMDUgTDE3NSA5MCBaIiBmaWxsPSIjMDAwIi8+PHRleHQgeD0iMTYwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UzAxRTAxPC90ZXh0Pjwvc3ZnPg==",
        videoFilePath: "path/to/video.mp4",
        associatedFiles: ["path/to/subtitle.srt", "path/to/audio.mp3", "path/to/nfo.nfo"],
    },
    {
        name: "Episode 2",
        seasonNumber: 1,
        episodeNumber: 1,
        thumbnail: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzIwIDE4MCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiMxYTFhMWEiLz48Y2lyY2xlIGN4PSIxNjAiIGN5PSI5MCIgcj0iMzAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC45KSIvPjxwYXRoIGQ9Ik0xNTAgNzUgTDE1MCAxMDUgTDE3NSA5MCBaIiBmaWxsPSIjMDAwIi8+PHRleHQgeD0iMTYwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UzAxRTAxPC90ZXh0Pjwvc3ZnPg==",
        videoFilePath: "path/to/video.mp4",
        associatedFiles: ["path/to/subtitle.srt", "path/to/audio.mp3", "path/to/nfo.nfo"],
    },
];

const mockSeasons: Season[] = [
    {
        name: "Season 0: Special Episodes",
        seasonNumber: 0,
        episodes: episodes,
    },
    {
        name: "Season 1: Breaking Bad",
        seasonNumber: 1,
        episodes: episodes,
    },
];



interface EpisodeItemProps {
    episode: Episode;
    selected: boolean;
}

function getFileTag(file: string): "VID" | "SUB" | "AUD" | "NFO" | "" {
    // TODO: implement this function, the origin SMM has static config for all extension of types
    if (file.endsWith(".srt")) {
        return "SUB";
    }
    if (file.endsWith(".mp3")) {
        return "AUD";
    }
    return "";
}

interface FileItem {
    tag: "VID" | "SUB" | "AUD" | "NFO";
    /**
     * Relative path of media folder, in POSIX format
     */
    path: string;
}

function EpisodeItem({ episode, selected }: EpisodeItemProps) {

    const tag = useMemo(() => {
        return `S${episode.seasonNumber}E${episode.episodeNumber}`;
    }, [episode.seasonNumber, episode.episodeNumber]);

    const associatedFiles: FileItem[] = useMemo(() => {
        return episode.associatedFiles.map((file) => {
            return {
                tag: getFileTag(file),
                path: file,
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
            <Image
              url={episode.thumbnail}
              className="w-[150px] h-[80px]"
            />
        </div>
        <div>
            <div> <span className="text-sm text-muted-foreground select-none p-1">{tag}</span> 
              {episode.name}
            </div>
            <div className="text-sm text-muted-foreground"> 
                <span className="text-sm text-muted-foreground select-none p-1">VID</span> 
                {episode.videoFilePath}
            </div>
            {
                associatedFiles.map((file) => (
                    <div className="text-sm text-muted-foreground">
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


export function TvShowEpisodes() {

    const [seasons, setSeasons] = useState<Season[]>(mockSeasons);

    return (
        <div>

{
    seasons.map((season) => (
        <Accordion type="single" collapsible>
            <AccordionItem value={season.name}>
                <AccordionTrigger>{season.name}</AccordionTrigger>
                <AccordionContent>
                    {season.episodes.map((episode) => (
                        <EpisodeItem key={episode.name} episode={episode} />
                    ))}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    ))
}


        </div>
    )
}