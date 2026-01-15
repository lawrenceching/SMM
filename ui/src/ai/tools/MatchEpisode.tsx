import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from 'zod/v3';
import { useMediaMetadata } from "@/components/media-metadata-provider";
import { useEffect } from "react";
import type { MediaFileMetadata, MediaMetadata } from "@core/types";
import { Path } from "@core/path";

let mediaMetadatas: MediaMetadata[] = [];
let updateMediaMetadata: (path: string, mediaMetadata: MediaMetadata) => void = () => {};

function updateMediaFileMetadatas(
    mediaFiles: MediaFileMetadata[], 
    videoFilePath: string, 
    seasonNumber: number, 
    episodeNumber: number): MediaFileMetadata[] {

    // Check if videoFilePath already exists
    const existingIndex = mediaFiles.findIndex(file => file.absolutePath === videoFilePath);
    
    if (existingIndex !== -1) {
        // Update existing entry
        const existingFile = mediaFiles[existingIndex];
        console.log(`Update media file "${videoFilePath}" from season ${existingFile.seasonNumber ?? '?'} episode ${existingFile.episodeNumber ?? '?'} to season ${seasonNumber} episode ${episodeNumber}`);
        const updatedFiles = [...mediaFiles];
        updatedFiles[existingIndex] = {
            ...updatedFiles[existingIndex],
            seasonNumber,
            episodeNumber
        };
        return updatedFiles;
    } else {
        // Add new entry
        console.log(`Add media file "${videoFilePath}" season ${seasonNumber} episode ${episodeNumber}`);
        return [
            ...mediaFiles,
            {
                absolutePath: videoFilePath,
                seasonNumber,
                episodeNumber
            }
        ];
    }
}


const episodeMatchSchema = z.object({
    folderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
    path: z.string().describe("The absolute path of the video file, it can be POSIX format or Windows format"),
    seasonNumber: z.number().describe("The season number"),
    episodeNumber: z.number().describe("The episode number"),
});

const matchEpisode = tool({
    description: `Match local file to episodes of a TV show.
For example, use this tool to indicate "/path/to/media/folder/Episode 1/file1.mp4" in folder "/path/to/media/folder" is for episode 1 of season 1.
This tool return JSON response with the following format:
\`\`\`typescript
interface ToolResponse {
    // error message
    error?: string;
}
\`\`\`typescript
`,
    parameters: episodeMatchSchema,
    execute: async ({ folderPath, path, seasonNumber, episodeNumber }: z.infer<typeof episodeMatchSchema>) => {
        console.log(`[MatchEpisodeTool] Match episode ${seasonNumber} ${episodeNumber} in folder "${folderPath}" with file "${path}"`);
        const folderPathInPosix = Path.posix(folderPath)

        // 1. Check if folderPathInPosix is valid
        const mediaMetadata = mediaMetadatas.find(m => m.mediaFolderPath === folderPathInPosix);
        if (!mediaMetadata) {
            return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` };
        }

        // 2. Check if path is valid
        const pathInPosix = Path.posix(path);
        const files = mediaMetadata.files;
        if (!files || !files.includes(pathInPosix)) {
            return { error: `Error Reason: path "${pathInPosix}" is not a file in the media folder` };
        }

        // 3. Check episodeNumber and seasonNumber is valid
        const tmdbTvShow = mediaMetadata.tmdbTvShow;
        if (!tmdbTvShow) {
            return { error: `Error Reason: TMDB TV show data is not available for this media folder` };
        }

        const season = tmdbTvShow.seasons?.find(s => s.season_number === seasonNumber);
        if (!season) {
            return { error: `Error Reason: season ${seasonNumber} does not exist in TMDB TV show` };
        }

        const episode = season.episodes?.find(e => e.episode_number === episodeNumber);
        if (!episode) {
            return { error: `Error Reason: episode ${episodeNumber} does not exist in season ${seasonNumber}` };
        }

        updateMediaMetadata(folderPathInPosix, {
            ...mediaMetadata,
            mediaFiles: updateMediaFileMetadatas(mediaMetadata.mediaFiles ?? [], pathInPosix, seasonNumber, episodeNumber)
        });

        return {
            error: undefined
        };
    },
});

const _MatchEpisodeTool = makeAssistantTool({
    ...matchEpisode,
    toolName: "match-episode",
});

export function MatchEpisodeTool() {

    const { mediaMetadatas: mediaMetadatasFromProvider, updateMediaMetadata: updateMediaMetadataFromProvider } = useMediaMetadata();

    useEffect(() => {
        mediaMetadatas = mediaMetadatasFromProvider;
        updateMediaMetadata = updateMediaMetadataFromProvider;
    }, [mediaMetadatasFromProvider]);
    
    return <>
      <_MatchEpisodeTool />
    </>
}