## Context

The `rename-folder` tool currently has two separate implementations:

1. **MCP Server Implementation** (`cli/src/mcp/tools/renameFolderTool.ts`):
   - Complete implementation with proper folder renaming
   - Uses `rename()` from Node.js fs/promises
   - Handles path normalization for POSIX and Windows formats via `Path.toPlatformPath()`
   - Updates metadata cache files after rename
   - Returns detailed responses with `renamed`, `from`, `to` fields
   - Properly handles errors including invalid paths and filesystem errors

2. **AI Agent Implementation** (`cli/src/tools/renameFolder.ts`):
   - Uses deprecated `zod/v3` import
   - Creates tool via `createRenameFolderTool(clientId, abortSignal)` factory function
   - Includes user confirmation flow via socketIO acknowledgement
   - Returns different response format
   - Lacks the unified tool pattern structure

The goal is to consolidate these into a unified pattern similar to `isFolderExist`, `listFiles`, and `getMediaMetadata`.

## Goals / Non-Goals

**Goals:**
- Refactor `rename-folder` to use the unified tool pattern
- Create a single base implementation in `cli/src/tools/renameFolder.ts`
- Expose the tool through both `agentTools` and `mcpTools` exports
- Ensure consistent behavior between MCP and AI Agent interfaces
- Maintain user confirmation flow for the AI Agent
- Update `ChatTask.ts` to use `agentTools.renameFolder(clientId, abortSignal)`

**Non-Goals:**
- Refactor other tools beyond `rename-folder` at this stage
- Change the tool's input/output schema or core functionality
- Modify error handling behavior beyond what already exists in MCP implementation
- Remove the user confirmation flow - it will be maintained in the unified pattern

## Decisions

### 1. Base Implementation Location

**Decision**: Use `cli/src/tools/renameFolder.ts` as the base implementation location.

**Rationale**: This follows the established pattern where base implementations live in `cli/src/tools/` and are exposed through both interfaces.

### 2. Tool Structure Pattern

**Decision**: Follow the existing unified pattern with three functions:

- `getTool(clientId?: string): ToolDefinition` - Core tool definition
- `renameFolderAgentTool(clientId: string)` - Wrapper for AI Agent
- `renameFolderMcpTool()` - Wrapper for MCP server

**Rationale**: This pattern is already proven working in `isFolderExist`, `listFiles`, and `getMediaMetadata`.

### 3. User Confirmation Flow

**Decision**: Keep the user confirmation flow in the unified tool pattern.

**Rationale**: The `rename-folder` operation is destructive and requires user confirmation. This is specific to the AI Agent use case. The confirmation will be triggered within the `execute` function of the agent tool.

### 4. Implementation Source

**Decision**: Use the complete MCP implementation logic from `cli/src/mcp/tools/renameFolderTool.ts` as the base for the core rename logic.

**Rationale**: The MCP implementation is complete and handles all edge cases. This ensures consistent behavior across both interfaces.

### 5. MCP Wrapper Location

**Decision**: Update `cli/src/mcp/tools/renameFolderTool.ts` to delegate to `mcpTools.renameFolder()`.

**Rationale**: This follows the pattern seen in `listFilesTool.ts` and keeps MCP-specific registration logic separate.

### 6. ChatTask Integration

**Decision**: Update `cli/tasks/ChatTask.ts` to use `agentTools.renameFolder(clientId, abortSignal)`.

**Rationale**: This simplifies the code and uses the consistent tool interface pattern while maintaining abortSignal support.

## Risks / Trade-offs

- **[Risk]** Breaking existing MCP clients during transition
  - **Mitigation**: The MCP tool still uses "rename-folder" as the tool name, maintaining API compatibility

- **[Risk]** Breaking AI Agent functionality
  - **Mitigation**: The refactored tool uses the complete implementation, improving consistency while maintaining user confirmation flow

- **[Trade-off]** Maintaining user confirmation flow vs. pure refactoring
  - **Mitigation**: The confirmation flow is a key feature for destructive operations; it will be integrated into the unified pattern

## Migration Plan

1. Create new unified tool functions in `cli/src/tools/renameFolder.ts`
2. Update exports in `cli/src/tools/index.ts`
3. Update MCP wrapper at `cli/src/mcp/tools/renameFolderTool.ts`
4. Update `cli/tasks/ChatTask.ts` to use `agentTools.renameFolder()`
5. Update MCP server registration if needed
6. Verify both MCP and AI Agent work correctly
7. Run TypeScript compiler to verify no type errors

## Open Questions

- None at this time. The pattern is well-defined by existing implementations.
