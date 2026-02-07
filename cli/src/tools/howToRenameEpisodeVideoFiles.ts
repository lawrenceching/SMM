import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

const guidelines = `# 如何使用 SMM MCP tool 重命名媒体文件

当用户要求重命名视频文件或媒体文件, 或整理视频文件的目录结构, AI助手应该参考一下步骤:

1. 当用户没有指定媒体目录时, 使用 "get-app-context" 工具获取 SMM 软件中用户当前选中的目录
2. 使用 "get-media-metadata" 工具获取媒体目录的媒体元数据, 主要关注电视剧的季集信息
3. 使用 "get-episode" 工具获取每一集的本地视频文件路径
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

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('how-to-rename-episode-video-files');

  return {
    toolName: "how-to-rename-episode-video-files",
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

export async function howToRenameEpisodeVideoFilesMcpTool() {
  return getTool();
}
