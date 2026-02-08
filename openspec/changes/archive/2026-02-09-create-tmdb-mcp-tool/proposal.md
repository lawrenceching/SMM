## Why

SMM currently exposes TMDB (The Movie Database) functionality only through HTTP REST API endpoints. However, AI agents working through the MCP (Model Context Protocol) interface cannot directly query TMDB to search for movies/TV shows or retrieve metadata. This limits the AI's ability to help users identify, recognize, and organize media files that require TMDB metadata.

By exposing TMDB search and retrieval as MCP tools, AI agents can directly access movie/TV show information to assist with tasks like:
- Identifying unknown video files by searching TMDB
- Fetching accurate metadata for media recognition
- Helping users select the correct TV show/movie during rename tasks
- Providing rich media information during media management workflows

## What Changes

- **New MCP Tools**: Create 3 new MCP tools to expose TMDB functionality:
  - `tmdb-search`: Search TMDB for movies or TV shows by keyword
  - `tmdb-get-movie`: Retrieve detailed movie information by TMDB ID
  - `tmdb-get-tv-show`: Retrieve detailed TV show information by TMDB ID (including seasons and episodes)

- **Code Reuse**: Leverage existing TMDB business logic from `cli/src/route/Tmdb.ts`:
  - Reuse `search()` function for search operations
  - Reuse `getMovie()` function for movie retrieval
  - Reuse `getTvShow()` function for TV show retrieval
  - Reuse configuration and HTTP request handling infrastructure

- **MCP Registration**: Register new tools in `cli/src/mcp/mcp.ts` following existing tool patterns

- **Internationalization**: Add tool descriptions to i18n translation files (`cli/public/locales/{lng}/tools.json`)

## Capabilities

### New Capabilities

- **tmdb-mcp-tools**: Expose TMDB search and metadata retrieval functionality through MCP protocol
  - Enable AI agents to search for movies and TV shows by keyword
  - Enable AI agents to retrieve detailed metadata (title, overview, release date, poster images, etc.)
  - Support multiple languages (English, Chinese, Japanese)
  - Support custom TMDB hosts and proxy configuration

### Modified Capabilities

None - this is a new feature that does not modify existing capability requirements.

## Impact

### Affected Code
- **`cli/src/mcp/tools/`** - Create 3 new tool files:
  - `tmdbSearchTool.ts`
  - `tmdbGetMovieTool.ts`
  - `tmdbGetTvShowTool.ts`
- **`cli/src/mcp/mcp.ts`** - Register new MCP tools
- **`cli/public/locales/en/tools.json`** - Add English tool descriptions
- **`cli/public/locales/zh-CN/tools.json`** - Add Chinese tool descriptions

### Dependencies
- Reuses existing dependencies: `@core/types`, `@modelcontextprotocol/sdk`
- No new external dependencies required

### APIs
- Internal: Reuses existing TMDB functions from `cli/src/route/Tmdb.ts`
- External: No changes to TMDB API integration (uses existing implementation)

### Systems
- MCP server will expose 3 additional tools to AI agents
- No impact on HTTP REST API or desktop application
- No breaking changes to existing functionality
