export const MSG_FOLDER_NOT_FOUND = `Folder Not Found`
export const MSG_UNKNOWN_TV_SHOW = `SMM don't know the TV show info for requested media folder.
Ask user to search and match the TV show first.`

export interface GetEpisodesToolRequest {
    /**
     * Absolute path in platform-specific format
     */
    mediaFolderPath: string
}

export interface GetEpisodesToolResponse {
    status: "success" | "failure";
    message?: string;
    episodes?: {
        seasonNumber: number;
        episodeNumber: number;
        /**
         * Title of the episode
         */
        title: string;
    }[];
}