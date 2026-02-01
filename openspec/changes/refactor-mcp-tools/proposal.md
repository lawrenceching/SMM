# Proposal: Refactor MCP Tools Registration

## Why

The current MCP tool implementation has inconsistent registration patterns that hinder maintainability and scalability. Tool definitions and registrations are scattered between `mcp.ts` and individual tool files, making it difficult to add, modify, or remove tools without risking breaking changes. This approach violates the single responsibility principle and makes the codebase harder to navigate, test, and extend. By adopting a consistent pattern where each tool file exports its own registration function, we achieve modularity, better separation of concerns, and easier testing. This refactoring will also enable future improvements like dynamic tool discovery and automated tool registration.

## What Changes

- **Add registration functions to existing tool files**: Each tool file in `cli/src/mcp/tools/` will export a `registerXxxTool(server: McpServer)` function following the pattern established by `registerCalculateTool` and `registerGetMediaFoldersTool`

- **Update `mcp.ts` to use registration functions**: Replace inline `server.registerTool()` calls with calls to the registration functions exported by each tool module

- **Update `tools/index.ts` to export registration functions**: Add exports for the new registration functions alongside existing handler exports

- **Update `mcp/index.ts`** if needed for stdio server registration

## Capabilities

### Modified Capabilities

- `mcp-file-operations`: Refactor tool registration for file operation tools (`is-folder-exist`, `list-files`)
- `mcp-media-metadata`: Refactor tool registration for media metadata tools (`get-media-metadata`, `write-media-metadata`, `delete-media-metadata`)
- `mcp-rename`: Refactor tool registration for rename operation tools (`rename-folder`, `begin-rename-task`, `add-rename-file`, `end-rename-task`)
- `mcp-recognize`: Refactor tool registration for recognize operation tools (`begin-recognize-task`, `add-recognized-file`, `end-recognize-task`)
- `mcp-episodes-context`: Refactor tool registration for episode and context tools (`get-episodes`, `get-application-context`)

## Impact

- **Modified Files**:
  - `cli/src/mcp/mcp.ts` - Update to call registration functions instead of inline registrations
  - `cli/src/mcp/tools/*.ts` - Add registration functions to each tool file (12 files)
  - `cli/src/mcp/tools/index.ts` - Export registration functions
  - `mcp/index.ts` - Update stdio server registration if needed

- **Code Organization**: Improved separation of concerns with each tool file responsible for its own registration
- **Maintainability**: Easier to add, modify, or remove tools without touching the main `mcp.ts` file
- **Testing**: Each tool's registration can be tested independently
- **Extensibility**: Enables future features like dynamic tool discovery and plugin-based tool loading
