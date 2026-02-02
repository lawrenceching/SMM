## Context

The `listFiles` tool currently has two separate implementations:

1. **MCP Server Implementation** (`cli/src/mcp/tools/listFilesTool.ts`):
   - Complete implementation with proper file listing
   - Uses `listFiles()` from `@/utils/files`
   - Handles path normalization for POSIX and Windows formats via `Path.toPlatformPath()`
   - Returns detailed responses with file listing and count
   - Properly handles errors including invalid paths and filesystem errors

2. **AI Agent Implementation** (`cli/src/tools/listFilesInMediaFolder.ts`):
   - Uses deprecated `zod/v3` import
   - Simpler implementation that calls `listFiles()` from `@/utils/files`
   - Lacks the unified tool pattern structure
   - Used in `ChatTask.ts` with an inline wrapper pattern for abortSignal

The goal is to consolidate these into a unified pattern similar to `isFolderExist` and `getMediaFolders`.

## Goals / Non-Goals

**Goals:**
- Refactor `listFiles` to use the unified tool pattern
- Create a single base implementation in `cli/src/tools/listFiles.ts`
- Expose the tool through both `agentTools` and `mcpTools` exports
- Ensure consistent behavior between MCP and AI Agent interfaces
- Update `ChatTask.ts` to use `agentTools.listFiles(clientId)`

**Non-Goals:**
- Refactor other tools beyond `listFiles` at this stage
- Change the tool's input/output schema or core functionality
- Modify error handling behavior beyond what already exists in MCP implementation

## Decisions

### 1. Base Implementation Location

**Decision**: Use `cli/src/tools/listFiles.ts` as the base implementation location.

**Rationale**: This follows the established pattern where base implementations live in `cli/src/tools/` and are exposed through both interfaces.

### 2. Tool Structure Pattern

**Decision**: Follow the `isFolderExist` pattern with three functions:

- `getTool(clientId?: string): ToolDefinition` - Core tool definition
- `listFilesAgentTool(clientId: string)` - Wrapper for AI Agent
- `listFilesMcpTool()` - Wrapper for MCP server

**Rationale**: This pattern is already proven working in `isFolderExist` and `getMediaFolders`.

### 3. Implementation Source

**Decision**: Use the complete MCP implementation logic from `cli/src/mcp/tools/listFilesTool.ts` as the base.

**Rationale**: The MCP implementation is complete and handles path normalization, error handling, and response formatting. This ensures consistent behavior across both interfaces.

### 4. Input Schema

**Decision**: Use the `folderPath` parameter instead of `path` to match the existing MCP implementation.

**Rationale**: The MCP implementation already uses `folderPath` and changing it would break API compatibility.

### 5. MCP Wrapper Location

**Decision**: Update `cli/src/mcp/tools/listFilesTool.ts` to delegate to `mcpTools.listFiles()`.

**Rationale**: This follows the pattern seen in `isFolderExistTool.ts` and keeps MCP-specific registration logic separate.

### 6. ChatTask Integration

**Decision**: Update `cli/tasks/ChatTask.ts` to use `agentTools.listFiles(clientId)` instead of the inline wrapper pattern.

**Rationale**: This simplifies the code and uses the consistent tool interface pattern.

## Risks / Trade-offs

- **[Risk]** Breaking existing MCP clients during transition
  - **Mitigation**: The MCP tool still uses "list-files" as the tool name, maintaining API compatibility

- **[Risk]** Breaking AI Agent functionality
  - **Mitigation**: The refactored tool uses the complete implementation, improving consistency

- **[Trade-off]** Consolidating listFilesInMediaFolderTool into listFiles
  - **Mitigation**: The tools have similar functionality; consolidating them reduces duplication and maintenance burden

## Migration Plan

1. Create new unified tool functions in `cli/src/tools/listFiles.ts`
2. Update exports in `cli/src/tools/index.ts`
3. Update MCP wrapper at `cli/src/mcp/tools/listFilesTool.ts`
4. Update `cli/tasks/ChatTask.ts` to use `agentTools.listFiles()`
5. Update MCP server registration if needed
6. Verify both MCP and AI Agent work correctly
7. Remove or deprecate `cli/src/tools/listFilesInMediaFolder.ts`
8. Run TypeScript compiler to verify no type errors

## Open Questions

- None at this time. The pattern is well-defined by existing implementations.
