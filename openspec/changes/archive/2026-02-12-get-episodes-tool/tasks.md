# Tasks: get-episodes MCP Tool Implementation

## Pre-requisites

- [x] Existing `cli/src/tools/getEpisode.ts` analyzed - uses `findMediaMetadata()`
- [x] Data structure understood: combines TMDB + mediaFiles
- [x] Output format clarified:
  ```typescript
  [
    {
      season: number
      episode: number
      title?: string      // From TMDB
      videoFilePath?: string | undefined  // From mediaFiles (optional)
    }
  ]
  ```
- [x] Linking logic: Match `seasonNumber` + `episodeNumber` between sources
- [x] User confirmed: Single metadata read, combine data in memory

---

## Data Sources Summary

### Source 1: TMDB Data (`metadata.tmdbTvShow.seasons[].episodes[]`)
- `season_number`: number
- `episode_number`: number
- `name`: string (episode title)

### Source 2: Media Files (`metadata.mediaFiles[]`)
- `seasonNumber?: number`
- `episodeNumber?: number`
- `absolutePath`: string (video file path)

### Linking
```typescript
const key = `${seasonNumber}:${episodeNumber}`;  // e.g., "1:5"
videoFilePath = episodeToVideoMap.get(key);  // O(1) lookup
```

---

## Task 1: Create cli/src/tools/getEpisodes.ts

**Status**: Pending
**Artifact**: `create-getepisodesmcptool`

### Implementation

Create `cli/src/tools/getEpisodes.ts` with:

1. **Imports**: zod, ToolDefinition, createSuccessResponse/createErrorResponse, findMediaMetadata, Path, logger, getLocalizedToolDescription

2. **handleGetEpisodes()** function:
   - Accepts `{ mediaFolderPath }` and optional `abortSignal`
   - Validates path is non-empty string
   - Converts path to POSIX format
   - Calls `findMediaMetadata(posixPath)`
   - Error cases:
     - No metadata → "TV show not found"
     - No tmdbTvShow → "Not a TV show folder"
   - **Build episode-to-video map** from mediaFiles:
     ```typescript
     const episodeToVideoMap = new Map<string, string>();
     for (const mediaFile of metadata.mediaFiles || []) {
       if (mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined) {
         const key = `${mediaFile.seasonNumber}:${mediaFile.episodeNumber}`;
         episodeToVideoMap.set(key, mediaFile.absolutePath);
       }
     }
     ```
   - **Extract episodes** from TMDB seasons and combine:
     ```typescript
     for (const season of metadata.tmdbTvShow.seasons || []) {
       for (const tmdbEpisode of season.episodes || []) {
         const key = `${season.season_number}:${tmdbEpisode.episode_number}`;
         episodes.push({
           season: season.season_number,
           episode: tmdbEpisode.episode_number,
           title: tmdbEpisode.name,
           videoFilePath: episodeToVideoMap.get(key),  // May be undefined!
         });
       }
     }
     ```
   - Returns: `{ episodes: [...], totalCount, showName, numberOfSeasons }`

3. **getTool()** function:
   - Returns `ToolDefinition` with:
     - `toolName: "get-episodes"`
     - i18n description via `getLocalizedToolDescription('get-episodes')`
     - Input schema: `{ mediaFolderPath: string }`
     - Output schema: `{ episodes: [...], totalCount, showName, numberOfSeasons }`

4. **getEpisodesMcpTool()** function:
   - Returns `getTool()`

### Output File Structure

```typescript
// cli/src/tools/getEpisodes.ts
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
  // Implementation with logging, validation, error handling
}

export async function getTool(): Promise<ToolDefinition> {
  // Returns ToolDefinition with zod schemas
}

export async function getEpisodesMcpTool() {
  return getTool();
}
```

### Output Schema

```typescript
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
}).strict()
```

### Verification

- [ ] File compiles without errors
- [ ] Function signatures match pattern from `getEpisode.ts`
- [ ] Uses `createSuccessResponse`/`createErrorResponse` from mcpToolBase
- [ ] Episode-to-video map built correctly from mediaFiles
- [ ] Episodes extracted from TMDB seasons and combined

---

## Task 2: Create cli/src/mcp/tools/getEpisodesTool.ts

**Status**: Pending
**Artifact**: `create-getepisodesmcp-tool-registration`

### Implementation

Create wrapper file following pattern from `getEpisodeTool.ts`:

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

### Verification

- [ ] File compiles without errors
- [ ] `registerGetEpisodesTool` is exported

---

## Task 3: Update cli/src/tools/index.ts

**Status**: Pending
**Artifact**: `create-getepisodesmcp-tool-registration`
**Depends On**: Task 1, Task 2

### Changes

1. Add import:
   ```typescript
   import { createGetEpisodesTool, getEpisodesMcpTool } from './getEpisodes';
   ```

2. Add to exports:
   ```typescript
   export { createGetEpisodesTool, getEpisodesMcpTool };
   ```

3. Add to `mcpTools` object:
   ```typescript
   getEpisodes: getEpisodesMcpTool,
   ```

### Verification

- [ ] File compiles without errors
- [ ] `mcpTools.getEpisodes()` is accessible

---

## Task 4: Update cli/src/mcp/mcp.ts

**Status**: Pending
**Artifact**: `register-get-episodes-tool-in-mcp-server`
**Depends On**: Task 3

### Changes

1. Verify import on line 28:
   ```typescript
   import { registerGetEpisodesTool } from "./tools/getEpisodesTool";
   ```

2. Uncomment line 74:
   ```typescript
   await registerGetEpisodesTool(server);
   ```

### Verification

- [ ] File compiles without errors
- [ ] Tool registration call is active

---

## Task 5: Add i18n translation

**Status**: Pending
**Artifact**: `fix-mcp-tools-index-export`

### Changes

Add to `cli/public/locales/en/tools.json`:

```json
{
  "get-episodes": {
    "description": "Get all episodes for a TV show with their video file paths. Combines TMDB episode data with local media file paths. For each episode, returns season, episode number, title, and video file path (which may be undefined if the episode hasn't been recognized yet)."
  }
}
```

### Verification

- [ ] JSON is valid
- [ ] Translation key exists

---

## Testing

### Expected Response Format

```json
{
  "episodes": [
    {
      "season": 1,
      "episode": 1,
      "title": "The Pilot",
      "videoFilePath": "/path/to/S01E01.mkv"
    },
    {
      "season": 1,
      "episode": 2,
      "title": "Second Episode",
      "videoFilePath": undefined  // Valid - no video file recognized
    }
  ],
  "totalCount": 24,
  "showName": "TV Show Name",
  "numberOfSeasons": 2
}
```

### Test Cases

1. **All episodes recognized**:
   - Input: Valid TV show folder with all media files recognized
   - Expected: All episodes have `videoFilePath` defined

2. **Partial episodes recognized**:
   - Input: TV show with some episodes recognized
   - Expected: Mix of defined/undefined `videoFilePath`

3. **No episodes recognized**:
   - Input: TV show folder opened but no media files recognized
   - Expected: All episodes have `videoFilePath: undefined`

4. **Movie folder**:
   - Input: Movie folder path
   - Expected: `{ error: "Not a TV show folder..." }`

5. **Unknown folder**:
   - Input: Path with no metadata
   - Expected: `{ error: "TV show not found..." }`

6. **Invalid path**:
   - Input: Empty or invalid path
   - Expected: `{ error: "Invalid path..." }`

### Verification

- [ ] Single metadata read (check logs for one `findMediaMetadata` call)
- [ ] Episode-to-video map built correctly
- [ ] Episodes extracted from all seasons
- [ ] Undefined videoFilePath handled properly (not throwing errors)

---

## Rollback Plan

1. Delete `cli/src/tools/getEpisodes.ts`
2. Delete `cli/src/mcp/tools/getEpisodesTool.ts`
3. Revert changes to `cli/src/tools/index.ts`
4. Re-comment `registerGetEpisodesTool(server)` in `cli/src/mcp/mcp.ts`
5. Remove translation key from `cli/public/locales/en/tools.json`
