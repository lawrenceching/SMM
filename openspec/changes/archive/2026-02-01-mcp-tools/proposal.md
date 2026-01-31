## Why

The SMM CLI currently exposes an MCP server with only one tool (`get-media-folders`), while the AI chat feature in ChatTask.ts provides a rich set of 17+ tools for media management operations. This disparity limits what external AI assistants (like Claude Desktop or Cursor) can accomplish through MCP compared to the built-in chat interface. Exposing these tools via MCP will enable AI assistants to perform complex media management tasks programmatically, making SMM more powerful for automated workflows and AI-driven media organization.

## What Changes

- **New MCP Tools**: Implement 17+ new MCP tools equivalent to those available in the AI chat system
- **Tool Categories**:
  - File operations (folder existence, file listing)
  - Media metadata (read, write, delete)
  - Episode management (get episodes, match episodes)
  - Rename operations (folder rename, file rename batch tasks)
  - Recognition tasks (begin, add files, end)
  - Application context
- **Tool Handlers**: Create corresponding handler functions in `cli/src/mcp/` for each tool
- **Unit Tests**: Add comprehensive tests for each new tool handler
- **Documentation**: Update `cli/docs/MCP.md` with new tool documentation

## Capabilities

### New Capabilities
- `mcp-tool-is-folder-exist`: Check if a folder exists at the specified path
- `mcp-tool-list-files`: List files in a media folder with optional filtering
- `mcp-tool-get-media-metadata`: Read media metadata for a file
- `mcp-tool-write-media-metadata`: Write/update media metadata for a file
- `mcp-tool-delete-media-metadata`: Delete cached metadata for a file
- `mcp-tool-get-episodes`: Get TV show episode information from metadata
- `mcp-tool-rename-folder`: Rename a media folder
- `mcp-tool-rename-batch`: Batch rename files using task-based workflow
- `mcp-tool-recognize-batch`: Recognize and identify media files in batch
- `mcp-tool-get-context`: Get current application context and state

### Modified Capabilities
- `mcp-server`: Existing capability will be extended with additional tools (no spec-level behavior change, just implementation)

## Impact

- **Code Changes**:
  - New files in `cli/src/mcp/` for each tool handler
  - Updates to `cli/src/mcp/streamableHttp.ts` to register new tools
  - Updates to `cli/src/mcp/server.ts` to register new tools
  - New test files in `cli/src/mcp/` for each handler
- **Dependencies**: No new dependencies; uses existing tool implementations from `cli/src/tools/`
- **API Surface**: MCP server will expose ~18 tools instead of 1
- **Configuration**: No configuration changes required
- **Documentation**: `cli/docs/MCP.md` needs comprehensive update
