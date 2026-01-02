import { z } from 'zod';
import { executeHelloTask } from '../../tasks/HelloTask';
import { join } from 'path';

export const getMediaFoldersTool = {
  description: "Get the media folders that managed by SMM",
  inputSchema: z.object({}),
  execute: async (_args: {}, abortSignal?: AbortSignal) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    const { userDataDir } = await executeHelloTask();
    // TODO: Check abortSignal during file read
    const obj = await Bun.file(join(userDataDir, 'smm.json')).json();
    const folders = obj.folders;
    return folders;
  },
};

