/**
 * Exact set of MCP tool names advertised by the CLI MCP server
 * (`createMcpStreamableHttpHandler` with no `disabledTools`).
 * Keep in sync with `packages/core-routes/src/mcp/createServer.ts`.
 */
export const EXPECTED_MCP_TOOL_NAMES = [
  'get-app-context',
  'get-media-folders',
  'is-folder-exist',
  'list-files',
  'get-media-metadata',
  'tmdb-search',
  'tmdb-get-movie',
  'tmdb-get-tv-show',
  'tvdb-search',
  'tvdb-get-movie',
  'tvdb-get-tv-show',
  'tvdb-get-languages',
  'how-to-rename-episode-video-files',
  'how-to-recognize-episode-video-files',
  'readme',
  'rename-folder',
  'rename-episode-file',
  'scrape',
  'get-job',
  'create-rename-episode-plan',
  'create-recognize-episode-plan',
  'get-episode',
  'get-episodes',
] as const
