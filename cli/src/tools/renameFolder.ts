import { z } from 'zod';
import { Path } from '@core/path';
import { handleRenameFolder } from '../route/RenameFolder';
import { sendAndWaitForResponse } from '../utils/websocketManager';
import pino from 'pino';

const logger = pino();

export const createRenameFolderTool = (clientId: string) => ({
  description: `Rename a media folder in SMM.
This tool accepts the source folder path and destination folder path, and will ask for user confirmation before renaming.
Once confirmed, it will rename the folder on the filesystem, update the media metadata, and update the user configuration accordingly.

Example: Rename folder "/path/to/old-folder" to "/path/to/new-folder".
This tool return JSON response with the following format:
\`\`\`typescript
interface ToolResponse {
    // error message
    error?: string;
}
\`\`\`
`,
  toolName: 'renameFolder',
  inputSchema: z.object({
    from: z.string().describe("The current absolute path of the folder to rename, it can be POSIX format or Windows format"),
    to: z.string().describe("The new absolute path for the folder, it can be POSIX format or Windows format"),
  }),
  execute: async ({ from, to }: {
    from: string;
    to: string;
  }) => {
    logger.info({
      from,
      to,
      clientId
    }, '[tool][renameFolder] Starting folder rename operation');

    // Ask for user confirmation
    const getFolderName = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split('/').filter(p => p);
      return parts[parts.length - 1] || pathInPosix;
    };
    
    const confirmationMessage = `Rename folder "${getFolderName(from)}" to "${getFolderName(to)}"?\n\nThis will:\n  • Rename the folder on disk\n  • Update media metadata\n  • Update user configuration`;
    
    try {
      const responseData = await sendAndWaitForResponse(
        {
          event: 'askForConfirmation',
          data: {
            message: confirmationMessage,
          },
        },
        '', // responseEvent not needed with Socket.IO acknowledgements
        30000, // 30 second timeout
        clientId // Send to specific client room
      );

      const confirmed = responseData?.confirmed ?? responseData?.response === 'yes';
      
      if (!confirmed) {
        logger.info('[tool][renameFolder] User cancelled the operation');
        return { error: 'User cancelled the operation' };
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, '[tool][renameFolder] Error getting confirmation');
      return { error: `Error Reason: Failed to get user confirmation: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    // Perform the folder rename
    logger.info({
      from,
      to,
      clientId
    }, '[tool][renameFolder] Executing folder rename');

    const result = await handleRenameFolder(
      {
        from,
        to,
      },
      clientId
    );

    if (result.error) {
      logger.error({
        from,
        to,
        error: result.error,
        clientId
      }, '[tool][renameFolder] Folder rename failed');
      return { error: `Error Reason: ${result.error}` };
    }

    logger.info({
      from,
      to,
      clientId
    }, '[tool][renameFolder] Folder rename operation completed successfully');

    return {
      error: undefined
    };
  },
});

