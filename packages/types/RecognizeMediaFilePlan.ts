import type { PlanStatus, PlanCreator } from "./planCommon";

export interface RecognizedFile {
    season: number,
    episode: number,
    /**
     * The absolute path of the file, in POSIX format
     */
    path: string,
}

export interface RecognizeMediaFilePlan {
    /**
     * UUID of the plan
     */
    id: string;
    task: "recognize-media-file",
    /**
     * Plan lifecycle status.
     * - `preparing`: plan created, content (files) not computed yet
     * - `pending`: ready for user review
     * - `completed`: user confirmed / applied
     * - `rejected`: user cancelled
     */
    status: PlanStatus,
    /**
     * Who created the plan: `app` (rule-based) or `ai` (AI Assistant / MCP).
     */
    creator: PlanCreator,
    /**
     * The absolute path of the media folder, in POSIX format
     */
    mediaFolderPath: string,
    files: RecognizedFile[],
}
