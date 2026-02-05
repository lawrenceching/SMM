import type { UserConfig } from "./types";

export const AskForRenameFilesConfirmation = {
  event: 'askForRenameFilesConfirmation',
  beginEvent: 'askForRenameFilesConfirmation_begin',
  endEvent: 'askForRenameFilesConfirmation_end',
  addFileEvent: 'askForRenameFilesConfirmation_addFile',
} as const;

export interface AskForRenameFilesConfirmationRequestData {
  files: {
    /**
     * Absolute path in POSIX format
     */
    from: string,
    /**
     * Absolute path in POSIX format
     */
    to: string,
  }[],
}

export interface AskForRenameFilesConfirmationResponseData {
  confirmed: boolean,
}

export interface AskForRenameFilesConfirmationBeginRequestData {
  mediaFolderPath: string,
}

export interface AskForRenameFilesConfirmationEndRequestData {
  mediaFolderPath: string,
}

export interface AskForRenameFilesConfirmationAddFileResponseData {
  /**
   * Absolute path in POSIX format
   */
  from: string,
  /**
   * Absolute path in POSIX format
   */
  to: string,
}

export const RecognizeMediaFilePlanReady = {
  event: 'recognizeMediaFilePlanReady',
} as const;

export interface RecognizeMediaFilePlanReadyRequestData {
  taskId: string,
  /**
   * Absolute path to the plan file in POSIX format
   */
  planFilePath: string,
}

export const RenameFilesPlanReady = {
  event: 'renameFilesPlanReady',
} as const;

export interface RenameFilesPlanReadyRequestData {
  taskId: string,
  /**
   * Absolute path to the plan file in POSIX format
   */
  planFilePath: string,
}

/* User config updated event: Start */

export const USER_CONFIG_UPDATED_EVENT = 'userConfigUpdated'

export interface UserConfigUpdatedEventData {
  property: keyof UserConfig,
  old: any
  new: any
}

export const USER_CONFIG_FOLDER_RENAMED_EVENT = 'userConfig.folderRenamed'

export interface UserConfigFolderRenamedEventData {
  /**
   * Absolute path in platform-specific format
   */
  from: string,
  /**
   * Absolute path in platform-specific format
   */
  to: string,
}

/* User config updated event: End */