# Design: get-episodes MCP Tool Implementation

## Overview

This document describes the implementation design for the `get-episodes` MCP tool, which returns all episodes for a TV show by combining data from both TMDB metadata and local media files.

## Data Sources

The tool reads from TWO sources:

### 1. TMDB Data (Episode Information)
```
metadata.tmdbTvShow.seasons[].episodes[]
├── episode_number: number
├── name: string
├── overview: string
├── air_date: string
└── ...
```

### 2. Media Files (Video File Paths)
```
metadata.mediaFiles[]
├── absolutePath: string
├── seasonNumber?: number
├── episodeNumber?: number
└── ...
```

### Linking Logic
Episodes are linked by matching `seasonNumber` and `episodeNumber` between TMDB data and media files.

## Output Format

```typescript
interface EpisodeInfo {
  season: number;
  episode: number;
  title?: string;        // From TMDBEpisode.name
  videoFilePath?: string; // From MediaFileMetadata.absolutePath (optional - may not exist)
}
```

Example response:
```json
[
  {
    "season": 1,
    "episode": 1,
    "title": "The Pilot",
    "videoFilePath": "/path/to/Season 1/Show Name - S01E01 - The Pilot.mkv"
  },
  {
    "season": 1,
    "episode": 2,
    "title": "The Second Episode",
    "videoFilePath": "/path/to/Season 1/Show Name - S01E02 - The Second Episode.mkv"
  },
  {
    "season": 1,
    "episode": 3,
    "title": "The Third Episode",
    "videoFilePath": undefined  // Valid case - video file not recognized yet
  }
]
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server                                │
│  (cli/src/mcp/mcp.ts)                                           │
│                                                                  │
│  registerGetEpisodesTool(server)                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          cli/src/mcp/tools/getEpisodesTool.ts            │  │
│  │                                                          │  │
│  │  registerGetEpisodesTool(server: McpServer)              │  │
│  │         │                                                 │  │
│  │         ▼                                                 │  │
│  │  mcpTools.getEpisodes() ──► getTool()                   │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          cli/src/tools/getEpisodes.ts                    │  │
│  │                                                          │  │
│  │  handleGetEpisodes(params, abortSignal)                   │  │
│  │  ├── findMediaMetadata(posixPath)                        │  │
│  │  ├── Check if tmdbTvShow exists                          │  │
│  │  ├── Build episode-to-video map from mediaFiles          │  │
│  │  │   (key: "season:episode", value: absolutePath)        │  │
│  │  ├── Extract all episodes from TMDB seasons             │  │
│  │  └── Combine: for each TMDB episode, find matching video │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Create `cli/src/tools/getEpisodes.ts`

```typescript
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { Path } from "@core/path";
import logger from "../../lib/logger";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface GetEpisodesParams {
  mediaFolderPath: string;
}

export async function handleGetEpisodes(
  params: GetEpisodesParams,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  logger.info({
    params,
    file: "tools/getEpisodes.ts"
  }, "[MCP] get-episodes tool started")

  const { mediaFolderPath } = params;
  const traceId = `get-episodes-${Date.now()}`;

  // Validation
  if (abortSignal?.aborted) {
    logger.info({
      traceId,
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool aborted: abort signal detected")
    return createErrorResponse("Request was aborted");
  }

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    logger.warn({
      traceId,
      mediaFolderPath,
      reason: "media folder path is empty or invalid",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool validation failed: invalid media folder path")
    return createErrorResponse("Invalid path: 'mediaFolderPath' must be a non-empty string");
  }

  // Convert path format
  const posixPath = Path.posix(mediaFolderPath);

  // Find metadata
  const metadata = await findMediaMetadata(posixPath);

  if (!metadata) {
    logger.warn({
      traceId,
      mediaFolderPath: posixPath,
      reason: "media metadata not found",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool failed: media metadata not found")
    return createErrorResponse("TV show not found. Please ensure the media folder is opened in SMM.");
  }

  // Check if it's a TV show
  if (!metadata.tmdbTvShow) {
    logger.warn({
      traceId,
      mediaFolderPath: posixPath,
      reason: "not a TV show - no tmdbTvShow data",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool failed: not a TV show folder")
    return createErrorResponse("Not a TV show folder. This tool only works with TV show media folders.");
  }

  logger.info({
    traceId,
    mediaFolderPath: posixPath,
    seasonCount: metadata.tmdbTvShow.seasons?.length || 0,
    mediaFileCount: metadata.mediaFiles?.length || 0,
    file: "tools/getEpisodes.ts"
  }, "[MCP] get-episodes tool: found media metadata, building episode list")

  // Build episode-to-video map from mediaFiles
  // Key format: "season:episode" (e.g., "1:5" for S01E05)
  const episodeToVideoMap = new Map<string, string>();
  if (metadata.mediaFiles && Array.isArray(metadata.mediaFiles)) {
    for (const mediaFile of metadata.mediaFiles) {
      if (mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined) {
        const key = `${mediaFile.seasonNumber}:${mediaFile.episodeNumber}`;
        episodeToVideoMap.set(key, mediaFile.absolutePath);
      }
    }
  }

  logger.info({
    traceId,
    mappedEpisodes: episodeToVideoMap.size,
    file: "tools/getEpisodes.ts"
  }, `[MCP] get-episodes tool: built episode-to-video map with ${episodeToVideoMap.size} entries`)

  // Extract all episodes from all TMDB seasons and combine with video paths
  const episodes: Array<{
    season: number;
    episode: number;
    title?: string;
    videoFilePath?: string;
  }> = [];

  for (const season of metadata.tmdbTvShow.seasons || []) {
    if (season.episodes && Array.isArray(season.episodes)) {
      for (const tmdbEpisode of season.episodes) {
        const key = `${season.season_number}:${tmdbEpisode.episode_number}`;
        const videoFilePath = episodeToVideoMap.get(key);

        episodes.push({
          season: season.season_number,
          episode: tmdbEpisode.episode_number,
          title: tmdbEpisode.name,
          videoFilePath: videoFilePath,  // May be undefined - valid case!
        });
      }
    }
  }

  logger.info({
    traceId,
    episodeCount: episodes.length,
    episodesWithVideos: episodes.filter(e => e.videoFilePath).length,
    file: "tools/getEpisodes.ts"
  }, `[MCP] get-episodes tool: found ${episodes.length} episodes (${episodes.filter(e => e.videoFilePath).length} with video files)`)

  return createSuccessResponse({
    episodes,
    totalCount: episodes.length,
    showName: metadata.tmdbTvShow.name,
    numberOfSeasons: metadata.tmdbTvShow.number_of_seasons,
  });
}

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('get-episodes');

  return {
    toolName: "get-episodes",
    description: description,
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the TV show media folder, in POSIX or Windows format"),
    }),
    outputSchema: z.object({
      episodes: z.array(z.object({
        season: z.number().describe("The season number"),
        episode: z.number().describe("The episode number"),
        title: z.string().optional().describe("The title of the episode from TMDB"),
        videoFilePath: z.string().optional().describe("The absolute path of the video file, undefined if not recognized yet"),
      })).describe("Array of all episodes with their video file paths"),
      totalCount: z.number().describe("Total number of episodes"),
      showName: z.string().describe("The name of the TV show"),
      numberOfSeasons: z.number().describe("Number of seasons in the show"),
    }).strict(),
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetEpisodes(args);
    },
  };
}

export async function getEpisodesMcpTool() {
  return getTool();
}
```

### 2. Create `cli/src/mcp/tools/getEpisodesTool.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-episodes tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerGetEpisodesTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.getEpisodes();
  server.registerTool(
    tool.toolName,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async (args: any) => {
      return await tool.execute(args);
    }
  );
}
```

## Key Implementation Points

### Single Metadata Read
The tool reads `findMediaMetadata()` only once and performs all lookups in memory:
1. Build `episodeToVideoMap` from `mediaFiles` (O(n) where n = number of media files)
2. Extract episodes from TMDB seasons (O(m) where m = total episodes)
3. Combine data (O(m) lookup in map)

### Video File Path Resolution
```
For each TMDB episode (season, episode):
  key = "season:episode"  // e.g., "1:5"
  videoFilePath = episodeToVideoMap.get(key)  // O(1) lookup
```

### Undefined videoFilePath
This is a **valid case** - the video file might not be recognized yet, but the episode still exists in TMDB data.

## Error Handling

| Scenario | Response |
|----------|----------|
| Invalid path | `{ error: "Invalid path: 'mediaFolderPath' must be a non-empty string" }` |
| Aborted | `{ error: "Request was aborted" }` |
| Metadata not found | `{ error: "TV show not found. Please ensure the media folder is opened in SMM." }` |
| Not a TV show | `{ error: "Not a TV show folder. This tool only works with TV show media folders." }` |
| Success | `{ episodes: [...], totalCount, showName, numberOfSeasons }` |

## Files to Create/Modify

1. **Create**: `cli/src/tools/getEpisodes.ts` - Core tool implementation
2. **Create**: `cli/src/mcp/tools/getEpisodesTool.ts` - MCP wrapper
3. **Modify**: `cli/src/tools/index.ts` - Export the new tool
4. **Modify**: `cli/src/mcp/mcp.ts` - Register the tool
5. **Modify**: `cli/public/locales/en/tools.json` - Add i18n translation

## Testing Scenarios

1. **TV show with all episodes recognized**: Returns all episodes with videoFilePath
2. **TV show with partial episodes recognized**: Returns mix of defined/undefined videoFilePath
3. **TV show with no media files recognized**: All episodes have undefined videoFilePath
4. **Movie folder**: Returns error "Not a TV show folder"
5. **Unknown folder**: Returns error "TV show not found"
