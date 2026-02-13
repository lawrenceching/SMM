import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

const guidelines = `# 如何使用 SMM MCP tool 识别季集视频文件

媒体文件件包含了多个视频文件. SMM可能无法识别或错误识别每一集对应的视频文件.
此操作用于在SMM中维护本地视频文件和季集的对应关系。
此操作只适用于电视剧(TV Show)类型的媒体文件夹。

当用户要求
1. 识别本地视频文件
2. 识别季集视频文件
3. 关联/链接/匹配 xxx.mp4 视频文件为第x季第y集时
表示用户想执行此操作.


AI助手应该参考以下步骤:

1. 当用户没有指定媒体目录时, 使用 "get-app-context" 工具获取 SMM 软件中用户当前选中的目录
2. 使用 get-metadata 工具获得媒体文件夹的媒体元数据. 该工具返回该文件夹的媒体类型, TMDB ID, 季集信息等.
   你需要为每一季每一集识别对应的本地视频文件
3. 使用 list-files 工具(设置 videoFileOnly=true)并查询媒体文件夹中的所有视频文件
2. 使用 "begin-recognize-task" 工具开始识别任务, 指定媒体文件夹路径
3. 使用 "add-recognized-media-file" 工具添加已识别的视频文件
4. 使用 "end-recognize-task" 工具结束识别任务, SMM 将处理识别计划

**NOTE** 识别任务完成后, SMM 会在后台处理识别计划, 用户可以在 SMM UI 中查看和确认识别结果.
`;

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('how-to-recognize-episode-video-files');

  return {
    toolName: "how-to-recognize-episode-video-files",
    description: description,
    inputSchema: z.object({}),
    outputSchema: z.object({
      text: z.string().describe("Markdown content"),
    }),
    execute: async () => {
      return createSuccessResponse({ text: guidelines });
    },
  };
}

export async function howToRecognizeEpisodeVideoFilesMcpTool() {
  return getTool();
}
