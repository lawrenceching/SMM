## Context

The `isFolderExist` tool currently has two separate implementations:

1. **MCP Server Implementation** (`cli/src/mcp/tools/isFolderExistTool.ts`):
   - Complete implementation with proper folder existence check
   - Uses `stat()` from Node.js fs/promises
   - Handles path normalization for POSIX and Windows formats
   - Returns detailed responses with `exists`, `path`, and `reason` fields
   - Properly handles errors including ENOENT for non-existent paths

2. **AI Agent Implementation** (`cli/src/tools/isFolderExist.ts`):
   - Incomplete stub that always returns `true`
   - Uses deprecated `zod/v3` import
   - Lacks proper implementation logic

The goal is to consolidate these into a unified pattern similar to `getMediaFolders` and `getApplicationContext`.

## Goals / Non-Goals

**Goals:**
- Refactor `isFolderExist` to use the unified tool pattern
- Use the complete MCP implementation as the base
- Expose the tool through both `agentTools` and `mcpTools` exports
- Ensure consistent behavior between MCP and AI Agent interfaces
- Update `ChatTask.ts` to use `agentTools.isFolderExist()`

**Non-Goals:**
- Refactor other tools beyond `isFolderExist` at this stage
- Change the tool's input/output schema or core functionality
- Modify error handling behavior beyond what already exists in MCP implementation

## Decisions

### 1. Base Implementation Location

**Decision**: Use `cli/src/tools/isFolderExist.ts` as the base implementation location.

**Rationale**: This follows the established pattern where base implementations live in `cli/src/tools/` and are exposed through both interfaces.

### 2. Tool Structure Pattern

**Decision**: Follow the `getApplicationContext` pattern with three functions:

- `getTool(clientId?: string): ToolDefinition` - Core tool definition
- `isFolderExistAgentTool(clientId: string)` - Wrapper for AI Agent
- `isFolderExistMcpTool()` - Wrapper for MCP server

**Rationale**: This pattern is already proven working in `getMediaFolders` and `getApplicationContext`.

### 3. Implementation Source

**Decision**: Use the complete MCP implementation logic from `cli/src/mcp/tools/isFolderExistTool.ts` as the base.

**Rationale**: The MCP implementation is complete and handles all edge cases. The AI Agent stub is incomplete. This ensures consistent behavior.

### 4. MCP Wrapper Location

**Decision**: Update `cli/src/mcp/tools/isFolderExistTool.ts` to delegate to `mExist()`.

**cpTools.isFolderRationale**: This follows the pattern seen in `getMediaFoldersTool.ts` and keeps MCP-specific registration logic separate.

## Risks / Trade-offs

- **[Risk]** Breaking existing MCP clients during transition
  - **Mitigation**: The MCP tool still uses "is-folder-exist" as the tool name, maintaining API compatibility

- **[Risk]** Breaking AI Agent functionality
  - **Mitigation**: The refactored tool uses the complete implementation, improving functionality from the stub

- **[Trade-off]** Initial development time vs long-term maintainability
  - **Mitigation**: Investment in this pattern enables faster future refactoring of other tools

## Migration Plan

1. Create new unified tool functions in `cli/src/tools/isFolderExist.ts`
2. Update exports in `cli/src/tools/index.ts`
3. Update MCP wrapper at `cli/src/mcp/tools/isFolderExistTool.ts`
4. Update `cli/src/mcp/mcp.ts` import if needed
5. Update `cli/tasks/ChatTask.ts` to use `agentTools.isFolderExist()`
6. Verify both MCP and AI Agent work correctly
7. Run TypeScript compiler to verify no type errors

## Open Questions

- None at this time. The pattern is well-defined by existing implementations.
