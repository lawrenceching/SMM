## Why

SMM serves dual roles as both an MCP server (exposing tools to external AI agents) and an AI Agent (providing a built-in AI chat interface). The `get-media-metadata` tool currently has duplicate implementations: the MCP server implementation in `cli/src/mcp/tools/getMediaMetadataTool.ts` is complete and functional, while the AI Agent implementation in `cli/src/tools/getMediaMetadata.ts` uses a deprecated `zod/v3` import and returns a different response format. Refactoring to use a unified tool pattern will eliminate duplication and ensure consistent behavior.

## What Changes

- Refactor `get-media-metadata` tool to follow the unified tool pattern demonstrated by `isFolderExist` and `listFiles`
- Create base implementation in `cli/src/tools/getMediaMetadata.ts` with `getTool()`, `getMediaMetadataAgentTool()`, and `getMediaMetadataMcpTool()` functions
- Update `cli/src/tools/index.ts` to export `getMediaMetadata` through both `agentTools` and `mcpTools` objects
- Update `cli/src/mcp/tools/getMediaMetadataTool.ts` to delegate to `mcpTools.getMediaMetadata()`
- Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaMetadata(clientId, abortSignal)` instead of `createGetMediaMetadataTool(clientId, abortSignal)`
- Remove the old `createGetMediaMetadataTool` function pattern

## Capabilities

### New Capabilities
- None (refactoring of existing capability)

### Modified Capabilities
- `mcp-tool-registration`: The MCP tool registration spec will be updated to include `get-media-metadata` tool in the unified tool pattern

## Impact

### Files Modified
- `cli/src/tools/getMediaMetadata.ts` - Refactor with unified pattern (getTool, getMediaMetadataAgentTool, getMediaMetadataMcpTool)
- `cli/src/tools/index.ts` - Add exports for `agentTools.getMediaMetadata` and `mcpTools.getMediaMetadata`
- `cli/src/mcp/tools/getMediaMetadataTool.ts` - Update to delegate to `mcpTools.getMediaMetadata()`
- `cli/src/mcp/mcp.ts` - Update registration call if needed
- `cli/tasks/ChatTask.ts` - Update to use `agentTools.getMediaMetadata()` with abortSignal support

### Systems Affected
- MCP Server tool registration
- AI Agent tool registration
- Chat task workflow
