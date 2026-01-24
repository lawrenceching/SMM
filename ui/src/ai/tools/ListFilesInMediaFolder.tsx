import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from 'zod/v3';
import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { useEffect } from "react";
import type { MediaMetadata } from "@core/types";

interface ToolResponse {
    message: string;
    files: string[];
}

let mediaMetadatas: MediaMetadata[] = [];

const getFilesInMediaFolder = tool({
    description: "List files in a media folder",
    parameters: z.object({
        path: z.string(),
    }),
    execute: async ({ path }) => {
        const mediaMetadata = mediaMetadatas.find(metadata => metadata.mediaFolderPath === path)

        if(!mediaMetadata) {
            return {
                message: `Media folder not found. The folder path may not correct or the folder is not managed by SMM`,
                files: [],
            } as ToolResponse;
        }

        return {
            message: `${mediaMetadata.files?.length ?? 0} files in media folder: ${path}`,
            files: mediaMetadata.files ?? [],
        } as ToolResponse;
    },
});

const _GetFilesInMediaFolderTool = makeAssistantTool({
    ...getFilesInMediaFolder,
    toolName: "get-files-in-media-folder",
});

export function GetFilesInMediaFolderTool() {

    const { mediaMetadatas: mediaMetadatasFromProvider } = useMediaMetadata();

    useEffect(() => {
        mediaMetadatas = mediaMetadatasFromProvider;
    }, [mediaMetadatasFromProvider]);
    
    return <>
    <_GetFilesInMediaFolderTool />
    </>
}