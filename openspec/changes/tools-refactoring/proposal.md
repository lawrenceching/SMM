## Why

SMM serves dual roles as both an MCP server (exposing tools to external AI agents like Claude Code and Cherry Studio) and an AI Agent (providing a built-in AI chat interface for users). Currently, many tools are duplicated across these two roles with separate implementations: one in `cli/src/tools/` for the AI Agent and another in `cli/src/mcp/` for the MCP server. This duplication causes maintenance overhead, inconsistent behavior between the two tool implementations, and violates the DRY principle.

The `getApplicationContext` tool has already been refactored to use a unified pattern where the base implementation lives in `cli/src/tools/getApplicationContext.ts` and is exposed through both `agentTools` and `mcpTools` exports. This refactoring should be applied to all tools to establish consistency across the codebase.

## What Changes

- Refactor `getMediaFolders` tool to follow the unified tool pattern demonstrated by `getApplicationContext`
- Move MCP-specific logic from `cli/src/mcp/getMediaFoldersTool.ts` to use the base tool implementation
- Update `cli/src/tools/index.ts` to export `getMediaFolders` through both `agentTools` and `mcpTools` objects
- Create `cli/src/mcp/tools/getMediaFoldersTool.ts` as a thin wrapper that delegates to `mcpTools.getMediaFolders()`
- Update `cli/src/mcp/mcp.ts` to register the refactored tool
- Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaFolders()` instead of importing `getMediaFoldersTool` directly
- Remove the old `cli/src/mcp/getMediaFoldersTool.ts` file

## Capabilities

### New Capabilities
- None (refactoring of existing capability)

### Modified Capabilities
- `mcp-tool-registration`: The MCP tool registration spec will be updated to reflect the new unified tool pattern for `getMediaFolders`

## Impact

### Files Modified
- `cli/src/tools/getMediaFolders.ts` - Refactor to add `getTool()`, `getMediaFoldersAgentTool()`, `getMediaFoldersMcpTool()` functions
- `cli/src/tools/index.ts` - Add exports for `agentTools.getMediaFolders` and `mcpTools.getMediaFolders`
- `cli/src/mcp/tools/getMediaFoldersTool.ts` - Create new wrapper (moved from `cli/src/mcp/`)
- `cli/src/mcp/mcp.ts` - Update to use new wrapper and import from new location
- `cli/tasks/ChatTask.ts` - Update to use `agentTools.getMediaFolders()`

### Files Removed
- `cli/src/mcp/getMediaFoldersTool.ts` - Old MCP tool implementation (replaced by new wrapper)

### Systems Affected
- MCP Server tool registration
- AI Agent tool registration
- Chat task workflow
