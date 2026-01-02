import { z } from 'zod';

export const isFolderExistTool = {
  description: "Check if the folder exists in the file system",
  inputSchema: z.object({
    path: z.string().describe("The absolute path of the media folder in POSIX or Windows format"),
  }),
  execute: async ({ path }: { path: string }, abortSignal?: AbortSignal) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    // TODO: implement folder existence check
    return true;
  },
};

