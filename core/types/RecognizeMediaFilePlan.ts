export interface RecognizedFile {
    season: number,
    episode: number,
    /**
     * The absolute path of the file, in POSIX format
     */
    path: string,
}

export interface RecognizeMediaFilePlan {
    task: "recognize-media-file",
    status: "pending" | "completed" | "rejected",
    /**
     * The absolute path of the media folder, in POSIX format
     */
    mediaFolderPath: string,
    files: RecognizedFile[],
}