import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

const guidelines = `# 如何使用 SMM MCP tool 识别季集视频文件

当用户要求识别视频文件或季集时, 表示用户想执行此操作.

AI助手应该参考以下步骤:

1. 当用户没有指定媒体目录时, 使用 "get-app-context" 工具获取 SMM 软件中用户当前选中的目录
2. 使用 "begin-recognize-task" 工具开始识别任务, 指定媒体文件夹路径
3. 使用 "add-recognized-media-file" 工具添加已识别的视频文件, 每个文件需要提供:
   - 季数 (season)
   - 集数 (episode)
   - 文件路径 (path)
4. 使用 "end-recognize-task" 工具结束识别任务, SMM 将处理识别计划

## 使用示例

假设你要识别 "/path/to/tv/show" 文件夹中的季集视频文件:

1. 首先开始识别任务:
   - 调用 "begin-recognize-task" 工具
   - 提供媒体文件夹路径: "/path/to/tv/show"
   - 获得任务 ID, 例如 "task-123"

2. 添加已识别的视频文件:
   - 调用 "add-recognized-media-file" 工具
   - 使用任务 ID: "task-123"
   - 添加第1季第1集: season=1, episode=1, path="/path/to/tv/show/S01E01.mp4"
   - 添加第1季第2集: season=1, episode=2, path="/path/to/tv/show/S01E02.mp4"
   - 继续添加所有已识别的视频文件

3. 结束识别任务:
   - 调用 "end-recognize-task" 工具
   - 使用任务 ID: "task-123"
   - SMM 将保存识别计划并通知用户审查

**NOTE** 识别任务是用于告诉 SMM 视频文件对应的季集信息. 用户需要知道每个视频文件是哪一季的哪一集.
如果用户不知道视频文件对应的季集信息, 可以建议用户使用 TMDB 查询或查看文件名中的季集信息.

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
