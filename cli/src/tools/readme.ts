import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

const readmeContent = `# Simple Media Manager (SMM)

SMM 用于管理电视剧、电影或音乐的本地文件夹。
当用户导入文件夹时，SMM可能无法自动识别该文件夹属于哪部电视剧或电影， 也无法识别电视剧每一集对应的本地视频文件。
识别多媒体文件夹和识别季集视频文件操作用于告知SMM该文件夹属于哪部电视剧或电影和视频文件和季集的对应关系。

本文描述了 SMM 的使用说明

## 核心概念

**多媒体文件夹(Media Folder)**: 多媒体文件夹, 保存了电视剧、电影或音乐文件
**媒体库(Media Library)**: 媒体库, 保存了多个多媒体文件夹
**识别多媒体文件夹(Recognize Media Folder)**: 该操作用于指定文件夹保存的是哪一部电视剧或电影的视频文件
**识别季集视频文件(Recognize Episode Video File)**: 该操作用于指定电视剧每一集对应的本地视频文件
**元数据(Media Metadata)**: 元数据, 保存了文件夹对应的电视剧或电影的信息，以及本地视频文件和季集的对应关系

## 常用操作

### 重命名

该操作只适用于已识别的季集视频文件。
多媒体文件夹下可能有其他视频文件（例如 OP, ED, 预告片, 花絮等），这些文件不属于季集视频文件，不支持被重命名。
执行该操作前，使用 "how-to-rename-episode-video-files" 工具获取操作说明。

** Goal **
1. 重命名季集视频文件名
2. 移动季集视频文件名

** Non Goal **
1. 修改文件夹下的其他文件

`;

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('readme');

  return {
    toolName: "readme",
    description: description,
    inputSchema: z.object({}),
    outputSchema: z.object({
      text: z.string().describe("Markdown content"),
    }),
    execute: async () => {
      return createSuccessResponse({ text: readmeContent });
    },
  };
}

export async function readmeMcpTool() {
  return getTool();
}
