import type { PlanStatus, PlanCreator } from "./planCommon";

export interface RenameFileEntry {
  /**
   * Absolute path of the source file in POSIX format
   */
  from: string
  /**
   * Absolute path of the destination file in POSIX format
   */
  to: string
}

export interface RenameFilesPlan {
  /**
   * UUID of the plan
   */
  id: string
  task: 'rename-files'
  /**
   * Plan lifecycle status.
   * - `preparing`: plan created, content (files) not computed yet
   * - `pending`: ready for user review
   * - `completed`: user confirmed / applied
   * - `rejected`: user cancelled
   */
  status: PlanStatus
  /**
   * Who created the plan: `app` (rule-based) or `ai` (AI Assistant / MCP).
   */
  creator: PlanCreator
  /**
   * Absolute path of the media folder in POSIX format
   */
  mediaFolderPath: string
  files: RenameFileEntry[]
}
