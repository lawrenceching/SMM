## Context

SMM currently has two parallel tool implementations for many features: one for the MCP server (in `cli/src/mcp/`) and one for the AI Agent (in `cli/src/tools/`). This duplication causes maintenance issues and potential inconsistencies. The `getApplicationContext` tool demonstrates the target pattern where the base implementation lives in `cli/src/tools/` and is exposed through both `agentTools` and `mcpTools` exports.

The `getMediaFolders` tool is currently duplicated:
- `cli/src/tools/getMediaFolders.ts` - AI Agent tool implementation
- `cli/src/mcp/getMediaFoldersTool.ts` - MCP server tool implementation

## Goals / Non-Goals

**Goals:**
- Refactor `getMediaFolders` to follow the unified tool pattern
- Eliminate code duplication while maintaining both MCP and AI Agent interfaces
- Ensure consistent behavior between MCP and AI Agent tool implementations
- Create a pattern that can be applied to other tools in future refactoring efforts

**Non-Goals:**
- Refactor other tools beyond `getMediaFolders` at this stage
- Change the underlying functionality of the `getMediaFolders` tool
- Modify the tool's input/output schema or behavior
- Update the MCP server infrastructure beyond the registration pattern

## Decisions

### 1. Tool Structure Pattern

**Decision**: Follow the `getApplicationContext` pattern with three functions in the base tool file.

**Rationale**: The `getApplicationContext` pattern is already established and proven working. It provides:
- `getTool()` - Core tool definition used by both MCP and agent
- `getMediaFoldersAgentTool()` - Wrapper for AI Agent with optional clientId
- `getMediaFoldersMcpTool()` - Wrapper for MCP server (no clientId needed)

**Alternatives Considered:**
- Create a single unified function with a parameter to distinguish MCP vs Agent usage - rejected because it would complicate the tool definition
- Use a class-based approach with inheritance - rejected as it adds unnecessary complexity

### 2. MCP Tool Wrapper Location

**Decision**: Create thin wrapper at `cli/src/mcp/tools/getMediaFoldersTool.ts` that imports from `mcpTools`.

**Rationale**: This follows the existing pattern seen in `getApplicationContextTool.ts` and keeps MCP-specific registration logic separate from the core tool implementation.

### 3. ChatTask Integration

**Decision**: Update `ChatTask.ts` to use `agentTools.getMediaFolders()` instead of importing `getMediaFoldersTool` directly.

**Rationale**: This ensures consistent access pattern with other tools and makes the dependency explicit through the `agentTools` object.

## Risks / Trade-offs

- **[Risk]** Breaking existing MCP clients during transition
  - **Mitigation**: The MCP tool registration still uses "get-media-folders" as the tool name, maintaining API compatibility

- **[Risk]** Breaking existing AI Agent functionality
  - **Mitigation**: The refactored tool maintains the same interface and behavior, just reorganized internally

- **[Trade-off]** Initial development time vs long-term maintainability
  - **Mitigation**: Investment in this pattern now will speed up future tool refactoring efforts

## Migration Plan

1. Create new tool functions in `cli/src/tools/getMediaFolders.ts`
2. Update exports in `cli/src/tools/index.ts`
3. Create new MCP wrapper at `cli/src/mcp/tools/getMediaFoldersTool.ts`
4. Update `cli/src/mcp/mcp.ts` to use new wrapper
5. Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaFolders()`
6. Remove old `cli/src/mcp/getMediaFoldersTool.ts`
7. Verify both MCP and AI Agent work correctly

## Open Questions

- None at this time. The pattern is well-defined by the existing `getApplicationContext` implementation.
