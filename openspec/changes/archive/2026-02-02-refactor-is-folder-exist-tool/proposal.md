## Why

SMM serves dual roles as both an MCP server (exposing tools to external AI agents) and an AI Agent (providing a built-in AI chat interface). The `isFolderExist` tool currently has duplicate implementations: the MCP server implementation in `cli/src/mcp/tools/isFolderExistTool.ts` is complete and functional, while the AI Agent implementation in `cli/src/tools/isFolderExist.ts` is incomplete and just returns `true`. Refactoring to use a unified pattern will eliminate duplication and ensure consistent behavior.

## What Changes

- Refactor `isFolderExist` tool to follow the unified tool pattern demonstrated by `getMediaFolders` and `getApplicationContext`
- Move the complete implementation from `cli/src/mcp/tools/isFolderExistTool.ts` to `cli/src/tools/isFolderExist.ts` as the base implementation
- Update `cli/src/tools/index.ts` to export `isFolderExist` through both `agentTools` and `mcpTools` objects
- Update `cli/src/mcp/tools/isFolderExistTool.ts` to delegate to `mcpTools.isFolderExist()`
- Update `cli/tasks/ChatTask.ts` to use `agentTools.isFolderExist()` instead of importing `isFolderExistTool` directly
- Update `cli/src/mcp/mcp.ts` to use the updated wrapper location
- Remove the duplicate implementation from the AI Agent tool

## Capabilities

### New Capabilities
- None (refactoring of existing capability)

### Modified Capabilities
- `mcp-tool-registration`: The MCP tool registration spec will be updated to include `is-folder-exist` tool in the unified tool pattern

## Impact

### Files Modified
- `cli/src/tools/isFolderExist.ts` - Refactor with unified pattern (getTool, isFolderExistAgentTool, isFolderExistMcpTool)
- `cli/src/tools/index.ts` - Add exports for `agentTools.isFolderExist` and `mcpTools.isFolderExist`
- `cli/src/mcp/tools/isFolderExistTool.ts` - Update to delegate to `mcpTools.isFolderExist()`
- `cli/src/mcp/mcp.ts` - Update import path if needed
- `cli/tasks/ChatTask.ts` - Update to use `agentTools.isFolderExist()`

### Systems Affected
- MCP Server tool registration
- AI Agent tool registration
- Chat task workflow
