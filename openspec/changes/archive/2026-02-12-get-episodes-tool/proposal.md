# Proposal: Implement get-episodes MCP Tool

## Problem Statement

The `get-episodes` MCP tool was defined in the specification (`openspec/specs/mcp/mcp-episodes-context/spec.md`) but the implementation was incomplete. The tool registration file `cli/src/mcp/tools/getEpisodesTool.ts` was deleted (as shown in git status), but:

1. It's still imported in `cli/src/mcp/mcp.ts` (line 28)
2. It's exported in `cli/src/mcp/tools/index.ts` (line 12)
3. The spec requires a `get-episodes` tool that returns all episodes for a TV show media folder

## Background

The existing codebase has:
- `cli/src/tools/getEpisodes.ts` - contains `createGetEpisodesTool` function
- `cli/src/tools/getEpisode.ts` - contains the singular `get-episode` tool (different purpose)
- `cli/src/mcp/tools/getEpisodeTool.ts` - MCP wrapper for singular tool
- No MCP wrapper for the plural `get-episodes` tool

The `get-episodes` tool should:
- Accept a media folder path
- Return all episodes for a TV show with season number, episode number, and title
- Handle errors for unknown TV shows, movie folders, and non-existent paths

## Proposed Solution

1. Add `getEpisodesMcpTool()` function to `cli/src/tools/getEpisodes.ts`
2. Export it in `cli/src/tools/index.ts`
3. Create `cli/src/mcp/tools/getEpisodesTool.ts` with `registerGetEpisodesTool` function
4. Uncomment the tool registration in `cli/src/mcp/mcp.ts`

## Scope

### In Scope
- Add MCP tool wrapper for `get-episodes` tool
- Register the tool in MCP server
- Ensure tool follows existing patterns and i18n support

### Out of Scope
- Changes to the core `getEpisodes.ts` logic
- Changes to other MCP tools
- UI changes

## Success Criteria

1. The `get-episodes` tool is registered and functional
2. The tool returns all episodes for a TV show media folder
3. Error handling works for unknown TV shows, movies, and non-existent paths
4. No import errors in `mcp.ts`
5. Tests pass (if any)

## Dependencies

- Existing `cli/src/tools/getEpisodes.ts` implementation
- MCP server infrastructure
- i18n infrastructure for tool descriptions
