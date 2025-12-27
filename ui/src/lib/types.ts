export interface FileProps {
    type: "file" | "video" | "subtitle" | "audio" | "nfo" | "poster"
    /**
     * Absolute path of the file in POSIX format
     */
    path: string
    /**
     * The absolute destination path in POSIX format, it's used to represent the destination path in renaming function
     */
    newPath?: string
}