## 1. Project Setup

- [x] 1.1 Add `@ai-sdk/mcp` dependency to `test/mcp-test-client/package.json`
- [x] 1.2 Verify `@modelcontextprotocol/sdk` is available or add if needed
- [x] 1.3 Review and update `test/mcp-test-client/tsconfig.json` for ESM compatibility
- [x] 1.4 Run `bun install` to install new dependencies

## 2. CLI Entry Point

- [x] 2.1 Create `test/mcp-test-client/index.ts` as the main CLI entry point
- [x] 2.2 Add shebang line for bun execution (`#!/usr/bin/env bun`)
- [x] 2.3 Set package.json `"bin"` field to point to `index.ts`
- [x] 2.4 Make the file executable on Unix systems

## 3. Command-Line Argument Parsing

- [x] 3.1 Implement `--tool` flag parsing (required)
- [x] 3.2 Implement `--args` flag parsing (optional, accepts JSON string)
- [x] 3.3 Implement `--help` flag parsing
- [x] 3.4 Validate required `--tool` argument
- [x] 3.5 Display help message when `--help` is used or arguments are invalid
- [x] 3.6 Handle unknown flags with error message

## 4. MCP Client Implementation

- [x] 4.1 Import `createMCPClient` from `@ai-sdk/mcp`
- [x] 4.2 Create MCP client with HTTP transport configuration
- [x] 4.3 Set server URL to `http://localhost:3000/mcp`
- [x] 4.4 Implement connection logic with error handling
- [x] 4.5 Implement proper cleanup (close client after use)
- [x] 4.6 Handle connection timeout and network errors

## 5. Tool Invocation Logic

- [x] 5.1 Use schema discovery mode to get available tools
- [x] 5.2 Validate tool name exists (check if tool is in discovered list)
- [x] 5.3 Parse `--args` JSON string into JavaScript object
- [x] 5.4 Handle JSON parsing errors with clear messages
- [x] 5.5 Invoke the specified tool with provided arguments
- [x] 5.6 Handle tool execution errors from server

## 6. Output Handling

- [x] 6.1 Format tool result as JSON string
- [x] 6.2 Print result to stdout using `console.log`
- [x] 6.3 Handle different response types (content, structured content, errors)
- [x] 6.4 Implement proper error output to stderr
- [x] 6.5 Set exit code 0 on success, 1 on error
- [x] 6.6 Ensure clean exit after response is received

## 7. Testing and Verification

- [x] 7.1 Test invoking a tool with no parameters (e.g., `get-application-context`)
- [x] 7.2 Test invoking a tool with parameters (e.g., `list-files --args '{"path": "..."}'`)
- [x] 7.3 Test error handling (unknown tool, invalid JSON, server not running)
- [x] 7.4 Verify output format is valid JSON
- [x] 7.5 Test help display with `--help` flag
