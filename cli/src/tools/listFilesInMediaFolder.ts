import { z } from 'zod/v3';
import { listFiles } from '@/utils/files';
import { Path } from '@core/path';

export const listFilesInMediaFolderTool = {
  description: `List the files in given media folder.
  This tool recursively lists all files in the media folder.
  `,
  inputSchema: z.object({
    path: z.string().describe("The absolute path of the media folder in POSIX or Windows format"),
  }),
  execute: async ({ path }: { path: string }, abortSignal?: AbortSignal) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    // TODO: validation
    // TODO: Check abortSignal during file listing
    return listFiles(new Path(path), true);
  },
};

