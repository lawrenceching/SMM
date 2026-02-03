## Why

SMM serves dual roles as both an MCP server (exposing tools to external AI agents) and an AI Agent (providing a built-in AI chat interface). The `rename-folder` tool currently has duplicate implementations: the MCP server implementation in `cli/src/mcp/tools/renameFolderTool.ts` is complete and functional, while the AI Agent implementation in `cli/src/tools/renameFolder.ts` uses a deprecated `zod/v3` import and follows a different pattern. Refactoring to use a unified tool pattern will eliminate duplication and ensure consistent behavior.

## What Changes

- Refactor `rename-folder` tool to follow the unified tool pattern demonstrated by `isFolderExist`, `listFiles`, and `getMediaMetadata`
- Create base implementation in `cli/src/tools/renameFolder.ts` with `getTool()`, `renameFolderAgentTool()`, and `renameFolderMcpTool()` functions
- Update `cli/src/tools/index.ts` to export `renameFolder` through both `agentTools` and `mcpTools` objects
- Update `cli/src/mcp/tools/renameFolderTool.ts` to delegate to `mcpTools.renameFolder()`
- Update `cli/tasks/ChatTask.ts` to use `agentTools.renameFolder(clientId, abortSignal)` instead of `createRenameFolderTool(clientId, abortSignal)`
- The user confirmation flow will be integrated into the unified tool pattern

## Capabilities

### New Capabilities
- None (refactoring of existing capability)

### Modified Capabilities
- `mcp-tool-registration`: The MCP tool registration spec will be updated to include `rename-folder` tool in the unified tool pattern

## Impact

### Files Modified
- `cli/src/tools/renameFolder.ts` - Refactor with unified pattern (getTool, renameFolderAgentTool, renameFolderMcpTool)
- `cli/src/tools/index.ts` - Add exports for `agentTools.renameFolder` and `mcpTools.renameFolder`
- `cli/src/mcp/tools/renameFolderTool.ts` - Update to delegate to `mcpTools.renameFolder()`
- `cli/src/mcp/mcp.ts` - Update registration call if needed
- `cli/tasks/ChatTask.ts` - Update to use `agentTools.renameFolder()`

### Systems Affected
- MCP Server tool registration
- AI Agent tool registration
- Chat task workflow
- User confirmation flow for folder renaming
