import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from 'zod';
import { useEffect } from "react";
import type { MediaMetadata } from "@core/types";
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore";
import { useQueryClient } from "@tanstack/react-query";
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/hooks/mediaMetadata";

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
    const { folders } = useUIMediaFolderStoreState();
    const queryClient = useQueryClient();

    useEffect(() => {
        mediaMetadatas = folders
            .map((folder) => {
                const pathPosix = normalizeMediaFolderPathForQuery(folder.path);
                if (!pathPosix) return undefined;
                return queryClient.getQueryData<MediaMetadata>(mediaMetadataQueryKey(pathPosix));
            })
            .filter((metadata): metadata is MediaMetadata => metadata !== undefined);
    }, [folders, queryClient]);
    
    return <>
    <_GetFilesInMediaFolderTool />
    </>
}