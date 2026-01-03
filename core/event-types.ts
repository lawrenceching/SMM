
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
