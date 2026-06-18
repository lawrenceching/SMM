import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSuccessResponse, type McpToolResponse } from "../index.ts";
import type { McpConfig } from "../types.ts";

/**
 * SMM README content. The original `apps/cli/src/tools/readme.ts`
 * keeps the same markdown; it is moved here so the same content is
 * available on both Bun and Node hosts.
 */
const README_CONTENT = `# Simple Media Manager (SMM)

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

### 识别文件夹

识别文件夹对应的是哪一步电视剧, 动画或电影

### 识别季集视频文件

识别 episode 对应的本地视频文件.
或电影的本地视频文件.

### 重命名

该操作只适用于已识别的季集视频文件。
多媒体文件夹下可能有其他视频文件（例如 OP, ED, 预告片, 花絮等），这些文件不属于季集视频文件，不支持被重命名。
执行该操作前，使用 "how-to-rename-episode-video-files" 工具获取操作说明。

** Goal **
1. 重命名季集视频文件名
2. 移动季集视频文件名

** Non Goal **
1. 修改文件夹下的其他文件

### 整理文件夹

依次完成识别文件夹, 识别季集视频文件, 重命名季集视频文件.
`;

const HOW_TO_RENAME_EPISODE_VIDEO_FILES = `# 如何使用 SMM MCP tool 重命名媒体文件

当用户要求重命名视频文件或媒体文件, 或整理视频文件的目录结构, 表示用户想执行此操作.

视频文件或媒体文件, 指的是SMM已经识别的视频文件, 即"get-episodes"工具返回的视频文件.
媒体文件夹内的其他视频文件**不是**本操作的目标

AI助手应该参考一下步骤:

1. 当用户没有指定媒体目录时, 使用 "get-app-context" 工具获取 SMM 软件中用户当前选中的目录
2. 使用 "get-media-metadata" 工具获取媒体目录的媒体元数据, 主要关注电视剧的季集信息
3. 使用 "get-episodes" 工具获取需要季集视频文件
4. 思考重命名命名方案
5. 使用 "begin-rename-episode-video-file-task" 工具开始重命名任务
6. 使用 "add-rename-episode-video-file-to-task" 工具添加需要重命名的文件
7. 使用 "end-rename-episode-video-file-task" 工具结束重命名任务

## 文件命名规则

多媒体服务器(如Plex, Jellyfin, Emby) 要求视频文件已特定格式命名, 否则无法识别。
当用户没有指定文件命名规则时, AI助手应该询问用户是否使用Plex命名规则。
下面列出了每个多媒体服务器要求的视频文件命名规则:

### Plex

{FolderName}/{TVShowName} - S{SeasonNumber}E{EpisodeNumber} - {EpisodeName}.{Extension}

FolderName: 季集文件夹名称, 如 "Season 01", "Season 02", "Season 03".特别地, 第0季的文件夹名称是 "Specials".

### Jellyfin

{FolderName}/{TVShowName} - S{SeasonNumber}E{EpisodeNumber} - {EpisodeName}.{Extension}

FolderName: 季集文件夹名称, 如 "Season 01", "Season 02", "Season 03".特别地, 第0季的文件夹名称是 "Specials".

**NOTE** AI助手不需要重命名视频文件的关联文件(如字幕,音频,海报等), SMM 会在内部自动重命名关联文件

**NOTE** SMM只支持重命名已识别的季集视频文件. "已识别"表示SMM知道该视频文件是哪一季的哪一集.
请使用 "get-episode" 工具来获得已识别的视频文件, **不要**使用 "list-files" 工具来获得所有视频文件.
当"get-episode"没有返回视频文件路径时, 表示SMM不知道该季该集对应的视频文件, AI助手可以跳过该季该集的视频文件重命名.
`;

const HOW_TO_RECOGNIZE_EPISODE_VIDEO_FILES = `# 如何使用 SMM MCP tool 识别季集视频文件

当用户要求识别季集视频文件, 或将视频文件关联到具体的季集时, 表示用户想执行此操作.

视频文件, 指的是媒体文件夹下的视频文件. AI助手需要为每一个视频文件确定它属于哪一季的哪一集.

AI助手应该参考以下步骤:

1. 当用户没有指定媒体目录时, 使用 "get-app-context" 工具获取 SMM 软件中用户当前选中的目录
2. 使用 "get-media-metadata" 工具获取媒体目录的媒体元数据, 主要关注电视剧的季集信息
3. 使用 "list-files" 工具列出媒体目录下的所有视频文件
4. 对比视频文件名和季集信息, 为每个视频文件确定它属于哪一季的哪一集
5. 使用 "begin-recognize-task" 工具开始识别任务
6. 使用 "add-recognized-file" 工具添加每个视频文件的识别结果
7. 使用 "end-recognize-task" 工具结束识别任务
`;

const STATIC_TEXT_TOOLS = {
  "how-to-rename-episode-video-files": HOW_TO_RENAME_EPISODE_VIDEO_FILES,
  "how-to-recognize-episode-video-files": HOW_TO_RECOGNIZE_EPISODE_VIDEO_FILES,
  "readme": README_CONTENT,
} as const;

type StaticTextToolName = keyof typeof STATIC_TEXT_TOOLS;

const STATIC_TEXT_TOOL_DESCRIPTIONS: Record<StaticTextToolName, string> = {
  "how-to-rename-episode-video-files":
    "Returns step-by-step guidance for renaming episode video files. Call this before starting a rename task.",
  "how-to-recognize-episode-video-files":
    "Returns step-by-step guidance for recognising which local video files correspond to which episodes. Call this before starting a recognise task.",
  "readme":
    "Returns the SMM overview: core concepts, common operations, and terminology.",
};

const staticTextInputSchema = z.object({});
const staticTextOutputSchema = z.object({
  text: z.string().describe("Markdown content"),
});

/**
 * Register all static-text MCP tools (readme + how-to guides).
 * Each tool takes no arguments and returns a markdown body.
 */
export function registerStaticTextTools(
  server: McpServer,
  config: McpConfig,
): void {
  for (const [name, content] of Object.entries(STATIC_TEXT_TOOLS)) {
    const toolName = name as StaticTextToolName;
    const description =
      config.toolDescriptions?.[toolName] ??
      STATIC_TEXT_TOOL_DESCRIPTIONS[toolName];

    server.registerTool(
      toolName,
      {
        description,
        inputSchema: staticTextInputSchema,
        outputSchema: staticTextOutputSchema,
      },
      async (): Promise<McpToolResponse> => {
        return createSuccessResponse({ text: content });
      },
    );
  }
}
