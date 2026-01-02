
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


  export const beginEvent = 'askForRenameFilesConfirmation_begin';
  export const endEvent = 'askForRenameFilesConfirmation_end';
  export const addFileEvent = 'askForRenameFilesConfirmation_addFile';


  export interface BeginRequestData {
    mediaFolderPath: string,
  }
  export interface EndRequestData {
    
  }
  export interface AddFileResponseData {
    /**
     * Absolute path in POSIX format
     */
    from: string,
    /**
     * Absolute path in POSIX format
     */
    to: string,
  }
}

