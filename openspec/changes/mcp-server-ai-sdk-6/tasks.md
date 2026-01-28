## 1. Dependencies and structure

- [x] 1.1 Add AI SDK 6 and MCP-related dependencies to cli `package.json`
- [x] 1.2 Create MCP server entry point or module under `cli/src/` (e.g. `mcp/` or `mcp-server.ts`)

## 2. get-media-folders tool

- [x] 2.1 Implement the `get-media-folders` tool handler that calls `getUserConfig()` and returns `userConfig.folders`
- [x] 2.2 Handle config read failure (missing or invalid file) by reporting a tool execution error to the client

## 3. MCP server wiring

- [x] 3.1 Register the `get-media-folders` tool with the MCP server (AI SDK 6 API)
- [x] 3.2 Choose and implement transport (stdio or HTTP) and document how to run/connect to the MCP server

## 4. Verification

- [x] 4.1 Verify scenario: client calls get-media-folders with config containing folders → returns same paths
- [x] 4.2 Verify scenario: config has empty folders → returns empty list
- [x] 4.3 Verify scenario: config missing or invalid → client receives error, no successful result
