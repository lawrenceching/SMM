import { readFileApi } from "@/api/readFile";
import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from "zod";
import { hello } from "@/api/hello";
import { join } from "@/lib/path";
import type { UserConfig } from "@core/types";

const getMediaFolders = tool({
    description: "Get media folders that managed by SMM",
    parameters: z.object(),
    execute: async ({ }) => {
        const { userDataDir } = await hello();
        const userConfig: UserConfig = await readFileApi(join(userDataDir, 'smm.json'));
        const folders = userConfig.folders;
        return folders;
    },
});
// Create the component
export const GetMediaFoldersTool = makeAssistantTool({
    ...getMediaFolders,
    toolName: "get-media-folders",
});
