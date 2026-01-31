## Context

### Background

The SMM CLI currently exposes an MCP server with only one tool (`get-media-folders`), while the AI chat feature in `ChatTask.ts` provides 13+ tools for media management operations. This disparity limits what external AI assistants (like Claude Desktop or Cursor) can accomplish through MCP compared to the built-in chat interface.

### Current State

The existing MCP implementation consists of:
- `cli/src/mcp/mcpServerManager.ts` - Server lifecycle management
- `cli/src/mcp/streamableHttp.ts` - Streamable HTTP transport
- `cli/src/mcp/server.ts` - Stdio transport
- `cli/src/mcp/getMediaFoldersTool.ts` - Single tool implementation

The chat tools in `cli/src/tools/` are designed for interactive sessions with Socket.IO events and require a `clientId` for user confirmation flows.

### Constraints

1. **MCP Statelessness**: MCP requests are stateless and don't have persistent client sessions
2. **No User Interaction**: MCP tools cannot prompt users for confirmation during execution
3. **Bun Runtime**: All code must run in the Bun JavaScript runtime
4. **Path Handling**: Tools must handle both POSIX and Windows paths correctly

### Stakeholders

- AI assistant users who want to automate media management via MCP
- Developers maintaining the MCP server implementation
- End users expecting consistent behavior between chat and MCP

## Goals / Non-Goals

**Goals:**
1. Expose 13+ media management tools via MCP for AI assistant integration
2. Design MCP-specific tool implementations that adapt chat tools for stateless execution
3. Maintain consistent behavior between chat and MCP tools where applicable
4. Create a scalable pattern for adding new MCP tools
5. Provide comprehensive documentation for all exposed tools

**Non-Goals:**
1. Implementing real-time UI updates via MCP (MCP is request-response only)
2. User confirmation dialogs in MCP (tools must work without interactive confirmation)
3. Real-time progress tracking during long operations
4. WebSocket-based communication (MCP uses HTTP/stdio transports only)
5. Modifying the existing chat tool implementations (they remain for chat usage)

## Decisions

### Decision 1: Tool Adaptation Strategy

**Choice**: Create MCP-specific tool implementations that wrap the core business logic from chat tools.

**Rationale**: The chat tools are tightly coupled with Socket.IO for user confirmation flows. Rather than modifying them, we extract the core logic into standalone handlers that can be called by both chat and MCP tools.

**Alternative Considered**: Modify existing tools to work without clientId
- **Rejected**: Would break existing chat functionality and add unnecessary complexity

### Decision 2: Tool Response Format

**Choice**: All MCP tools return a standardized response format with `content` array and optional `isError` flag.

**Rationale**: This aligns with MCP SDK expectations and provides consistent error handling across all tools.

**Response Structure**:
```typescript
interface McpToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
```

### Decision 3: Path Handling

**Choice**: All MCP tools accept paths in both POSIX and Windows formats and normalize internally.

**Rationale**: AI assistants may provide paths in either format depending on the OS. The `Path` class from `core/path.ts` handles this conversion.

### Decision 4: Error Handling Strategy

**Choice**: All errors are caught and returned as tool responses with `isError: true`.

**Rationale**: MCP doesn't support throwing exceptions to the client in the same way as direct function calls. All errors must be captured and returned as structured responses.

## Decisions - Tool Implementation Matrix

| Tool | Source | Adaptations Needed |
|------|--------|-------------------|
| `is-folder-exist` | `isFolderExistTool` | None - already stateless |
| `list-files` | `listFilesInMediaFolderTool` | None - already stateless |
| `get-media-metadata` | `getMediaMetadata` route | Wrap route logic in handler |
| `write-media-metadata` | `writeMediaMetadata` route | Wrap route logic in handler |
| `delete-media-metadata` | `deleteMediaMetadata` route | Wrap route logic in handler |
| `get-episodes` | `getEpisodesTool` | Remove clientId dependency |
| `rename-folder` | `renameFolderTool` | Skip confirmation, perform directly |
| `begin-rename-task` | `renameFilesTaskV2` | Remove Socket.IO, return taskId |
| `add-rename-file` | `renameFilesTaskV2` | Remove Socket.IO |
| `end-rename-task` | `renameFilesTaskV2` | Remove Socket.IO |
| `begin-recognize-task` | `recognizeMediaFilesTask` | Remove Socket.IO |
| `add-recognized-file` | `recognizeMediaFilesTask` | Remove Socket.IO |
| `end-recognize-task` | `recognizeMediaFilesTask` | Remove Socket.IO |
| `get-application-context` | `getApplicationContextTool` | Remove clientId, return static info |

## Risks / Trade-offs

### Risk: No User Confirmation for Destructive Operations

**[Risk]** Tools like `rename-folder` require user confirmation in the chat flow. Without this, AI assistants could accidentally rename folders.

**[Mitigation]** Design tools to accept an explicit `confirm: true` parameter for destructive operations. Log all operations for audit purposes.

### Risk: Inconsistent Behavior Between Chat and MCP

**[Risk]** Chat tools have UI feedback and confirmation flows; MCP tools operate silently.

**[Mitigation]** Document all behavioral differences clearly. Provide detailed response messages in MCP tools to compensate for lack of UI feedback.

### Risk: Session State Management

**[Risk]** Some tools (rename batch, recognize batch) use task IDs that must be tracked across multiple calls.

**[Mitigation]** Use in-memory task storage that persists for the server lifetime. Include cleanup mechanisms for abandoned tasks.

### Risk: Path Security

**[Risk]** AI assistants could potentially request paths outside configured media folders.

**[Mitigation]** Leverage existing path validation in `Path` class. Consider adding explicit path allowlist checks for sensitive operations.

## Migration Plan

### Phase 1: Infrastructure Setup
1. Create new tool handler files in `cli/src/mcp/tools/`
2. Update `cli/src/mcp/streamableHttp.ts` to register new tools
3. Update `cli/src/mcp/server.ts` to register new tools

### Phase 2: Core Tools
1. `is-folder-exist` - Simple file system check
2. `list-files` - Directory listing
3. `get-media-metadata` - Metadata reading
4. `write-media-metadata` - Metadata writing
5. `delete-media-metadata` - Metadata deletion

### Phase 3: Episode and Media Tools
1. `get-episodes` - TV show episode listing
2. `rename-folder` - Folder renaming

### Phase 4: Batch Operations
1. `begin-rename-task` - Start rename batch
2. `add-rename-file` - Add file to rename batch
3. `end-rename-task` - Finalize rename batch
4. `begin-recognize-task` - Start recognize batch
5. `add-recognized-file` - Add file to recognize batch
6. `end-recognize-task` - Finalize recognize batch

### Phase 5: Context and Documentation
1. `get-application-context` - Application state
2. Update `cli/docs/MCP.md` with all tool documentation
3. Add unit tests for all tools

### Rollback Strategy

If issues arise:
1. Remove tool registrations from `streamableHttp.ts` and `server.ts`
2. Keep handler files for future re-enablement
3. Update documentation to reflect disabled tools

## Open Questions

1. **Task Cleanup**: Should batch tasks have a timeout for automatic cleanup if `end-task` is never called?
2. **Path Validation**: Should we validate that paths are within configured media folders, or trust the AI assistant?
3. **Rate Limiting**: Should MCP tools implement rate limiting to prevent runaway AI behaviors?
4. **Logging**: Should all MCP tool calls be logged to a separate audit log?
5. **Tool Discovery**: How should AI assistants discover available tools and their parameters?
