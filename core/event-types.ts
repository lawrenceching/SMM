
export namespace AskForRenameFilesConfirmation {
  export const event = 'askForRenameFilesConfirmation';
  export interface RequestData {
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
  export interface ResponseData {
    confirmed: boolean,
  }
}

