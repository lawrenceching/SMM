import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from 'zod/v3';
import { useMediaMetadata } from "@/components/media-metadata-provider";
import { useEffect } from "react";
import type { MediaMetadata } from "@core/types";

let mediaMetadatas: MediaMetadata[] = [];

const getMediaMetadata = tool({
    description: "Get media metadata for a media folder. Returns a MediaMetadata object containing: TMDB information (id, title, overview, release date, ratings, genres, cast, crew), file information (video files, subtitles, audio tracks), and matched media files with their metadata like duration, resolution, and codec.",
    parameters: z.object({
        path: z.string().describe("The absolute path of the media folder in POSIX or Windows format"),
    }),
    execute: async ({ path }) => {
        const mediaMetadata = mediaMetadatas.find(metadata => metadata.mediaFolderPath === path)

        if (!mediaMetadata) {
            return {
                error: `Media folder not found. The folder path may not be correct or the folder is not managed by SMM`
            };
        }

        return mediaMetadata;
    },
});

const _GetMediaMetadataTool = makeAssistantTool({
    ...getMediaMetadata,
    toolName: "get-media-metadata",
});

export function GetMediaMetadataTool() {
    const { mediaMetadatas: mediaMetadatasFromProvider } = useMediaMetadata();

    useEffect(() => {
        mediaMetadatas = mediaMetadatasFromProvider;
    }, [mediaMetadatasFromProvider]);

    return <>
        <_GetMediaMetadataTool />
    </>
}

