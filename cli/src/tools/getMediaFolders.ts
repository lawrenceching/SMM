import { z } from 'zod';
import { executeHelloTask } from '../../tasks/HelloTask';
import { join } from 'path';

export const getMediaFoldersTool = {
  description: "Get the media folders that managed by SMM",
  inputSchema: z.object({}),
  execute: async () => {
    const { userDataDir } = await executeHelloTask();
    const obj = await Bun.file(join(userDataDir, 'smm.json')).json();
    const folders = obj.folders;
    return folders;
  },
};

