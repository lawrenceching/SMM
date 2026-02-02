## Context

The `get-media-metadata` tool currently has two separate implementations:

1. **MCP Server Implementation** (`cli/src/mcp/tools/getMediaMetadataTool.ts`):
   - Complete implementation with proper metadata retrieval
   - Uses `findMediaMetadata()` from `@/utils/mediaMetadata`
   - Handles folder validation via `stat()` from Node.js fs/promises
   - Returns detailed `McpToolResponse` with `found`, `metadata`, and `files` fields
   - Returns JSON-encoded content in the response

2. **AI Agent Implementation** (`cli/src/tools/getMediaMetadata.ts`):
   - Uses deprecated `zod/v3` import
   - Returns a different response format (`GetMediaMetadataResponse` with status/message/data)
   - Creates tool via `createGetMediaMetadataTool(clientId, abortSignal)` factory function
   - Lacks the unified tool pattern structure
   - Used in `ChatTask.ts` with abortSignal support

The goal is to consolidate these into a unified pattern similar to `isFolderExist` and `listFiles`.

## Goals / Non-Goals

**Goals:**
- Refactor `get-media-metadata` to use the unified tool pattern
- Create a single base implementation in `cli/src/tools/getMediaMetadata.ts`
- Expose the tool through both `agentTools` and `mcpTools` exports
- Maintain abortSignal support for AI Agent usage
- Ensure consistent behavior between MCP and AI Agent interfaces
- Update `ChatTask.ts` to use `agentTools.getMediaMetadata()`

**Non-Goals:**
- Refactor other tools beyond `get-media-metadata` at this stage
- Change the tool's input/output schema or core functionality
- Modify error handling behavior beyond what already exists in MCP implementation
- The AI Agent tool will maintain abortSignal support via a different pattern

## Decisions

### 1. Base Implementation Location

**Decision**: Use `cli/src/tools/getMediaMetadata.ts` as the base implementation location.

**Rationale**: This follows the established pattern where base implementations live in `cli/src/tools/` and are exposed through both interfaces.

### 2. Tool Structure Pattern

**Decision**: Follow the `listFiles` pattern with three functions:

- `getTool(abortSignal?: AbortSignal): ToolDefinition` - Core tool definition with optional abortSignal
- `getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal)` - Wrapper for AI Agent
- `getMediaMetadataMcpTool()` - Wrapper for MCP server

**Rationale**: This pattern is already proven working in `listFiles` and `isFolderExist`. The AI Agent wrapper will accept abortSignal as a parameter.

### 3. Implementation Source

**Decision**: Use the complete MCP implementation logic from `cli/src/mcp/tools/getMediaMetadataTool.ts` as the base.

**Rationale**: The MCP implementation is complete and handles folder validation, metadata lookup, and file listing. This ensures consistent behavior across both interfaces.

### 4. Response Format

**Decision**: Use the unified `McpToolResponse` format for both MCP and AI Agent interfaces.

**Rationale**: This provides consistency between the two interfaces. The AI Agent will receive structured content that can be parsed as needed.

### 5. MCP Wrapper Location

**Decision**: Update `cli/src/mcp/tools/getMediaMetadataTool.ts` to delegate to `mcpTools.getMediaMetadata()`.

**Rationale**: This follows the pattern seen in `listFilesTool.ts` and keeps MCP-specific registration logic separate.

### 6. ChatTask Integration

**Decision**: Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaMetadata(clientId, abortSignal)`.

**Rationale**: This simplifies the code and uses the consistent tool interface pattern while maintaining abortSignal support.

## Risks / Trade-offs

- **[Risk]** Breaking existing MCP clients during transition
  - **Mitigation**: The MCP tool still uses "get-media-metadata" as the tool name, maintaining API compatibility

- **[Risk]** Breaking AI Agent functionality
  - **Mitigation**: The refactored tool uses the complete implementation, improving consistency

- **[Trade-off]** Response format consistency vs. AI Agent expectations
  - **Mitigation**: The unified format is more structured; ChatTask can adapt to parse the response if needed

## Migration Plan

1. Create new unified tool functions in `cli/src/tools/getMediaMetadata.ts`
2. Update exports in `cli/src/tools/index.ts`
3. Update MCP wrapper at `cli/src/mcp/tools/getMediaMetadataTool.ts`
4. Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaMetadata()`
5. Update MCP server registration if needed
6. Verify both MCP and AI Agent work correctly
7. Run TypeScript compiler to verify no type errors

## Open Questions

- None at this time. The pattern is well-defined by existing implementations.
