import type { MediaMetadata } from "@core/types";

export interface MusicFileProps {
    type: "audio" | "video"
    /**
     * The absolute path of the file in platform specific format
     */
    path: string;

    filename: string;
    title?: string;
    artist?: string;
    thumbnailUri?: string;

    /**
     * Duration in seconds
     */
    duration?: number;
}

export interface MusicMediaMetadata extends MediaMetadata {
    musicFiles: MusicFileProps[];
}