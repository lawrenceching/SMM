## Why

SMM needs to expose its managed media folders to MCP (Model Context Protocol) clients so that AI assistants and tools can discover which folders SMM is managing. Using AI SDK 6 for MCP provides a standard, well-supported way to run an MCP server and expose a single tool, `get-media-folders`, that returns the same folder list as `userConfig.folders` from the CLI config.

## What Changes

- Add an MCP server in the **cli** module, built with AI SDK 6.
- Expose one tool: **get-media-folders**, which returns the SMM-managed media folder paths (i.e. `userConfig.folders` from `cli/src/utils/config.ts`).
- No changes to existing REST API or UI behavior.

## Capabilities

### New Capabilities

- `mcp-server-get-media-folders`: MCP server (AI SDK 6) in the cli module that exposes the `get-media-folders` tool, returning the list of media folder paths from user config.

### Modified Capabilities

- (none)

## Impact

- **cli**: New MCP server process or integration; use of `getUserConfig()` from `cli/src/utils/config.ts` to read `userConfig.folders`.
- **Dependencies**: AI SDK 6 and MCP-related packages in the cli workspace.
- **core**: No change to `UserConfig` or types; config shape remains as-is.
