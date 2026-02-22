import type { UIMediaMetadata } from "./UIMediaMetadata";

export interface MusicFileProps {
    type: "audio" | "video"
    /**
     * The absolute path of the file in platform specific format
     */
    path: string;

    filename: string;
    title?: string;
    author?: string;
    thumbnailUri?: string;

    /**
     * Duration in seconds
     */
    duration?: number;
}

export interface MusicMediaMetadata extends UIMediaMetadata {
    musicFiles: MusicFileProps[];
}