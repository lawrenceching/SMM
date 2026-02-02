## Why

SMM serves dual roles as both an MCP server (exposing tools to external AI agents) and an AI Agent (providing a built-in AI chat interface). The `listFiles` tool currently has duplicate implementations: the MCP server implementation in `cli/src/mcp/tools/listFilesTool.ts` is complete and functional, while the AI Agent implementation in `cli/src/tools/listFilesInMediaFolder.ts` uses an older pattern with deprecated `zod/v3` import and lacks the unified tool pattern. Refactoring to use a unified pattern will eliminate duplication and ensure consistent behavior.

## What Changes

- Refactor `listFiles` tool to follow the unified tool pattern demonstrated by `isFolderExist` and `getMediaFolders`
- Create base implementation in `cli/src/tools/listFiles.ts` with `getTool()`, `listFilesAgentTool()`, and `listFilesMcpTool()` functions
- Update `cli/src/tools/index.ts` to export `listFiles` through both `agentTools` and `mcpTools` objects
- Update `cli/src/mcp/tools/listFilesTool.ts` to delegate to `mcpTools.listFiles()`
- Update `cli/tasks/ChatTask.ts` to use `agentTools.listFiles()` instead of the inline wrapper pattern for listFilesInMediaFolder
- Remove the separate `listFilesInMediaFolderTool` from `cli/src/tools/listFilesInMediaFolder.ts` since it will be consolidated into the unified pattern

## Capabilities

### New Capabilities
- None (refactoring of existing capability)

### Modified Capabilities
- `mcp-tool-registration`: The MCP tool registration spec will be updated to include `list-files` tool in the unified tool pattern

## Impact

### Files Modified
- `cli/src/tools/listFiles.ts` - New file with unified pattern (getTool, listFilesAgentTool, listFilesMcpTool)
- `cli/src/tools/index.ts` - Add exports for `agentTools.listFiles` and `mcpTools.listFiles`
- `cli/src/mcp/tools/listFilesTool.ts` - Update to delegate to `mcpTools.listFiles()`
- `cli/tasks/ChatTask.ts` - Update to use `agentTools.listFiles(clientId)` instead of inline wrapper
- `cli/src/tools/listFilesInMediaFolder.ts` - Remove or deprecate in favor of unified tool

### Systems Affected
- MCP Server tool registration
- AI Agent tool registration
- Chat task workflow
