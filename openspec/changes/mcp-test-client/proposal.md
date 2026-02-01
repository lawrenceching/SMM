## Why

SMM provides an MCP server with various tools for media management operations, but there is no dedicated CLI tool to test and verify these tools independently. Developers need a quick way to invoke individual MCP tools from the command line to debug, test functionality, and validate server responses without needing to run the full application or build complex test scripts.

## What Changes

Create a command-line MCP client (`test/mcp-test-client/index.ts`) that:

- Connects to the SMM MCP server using AI SDK 6's MCP client
- Accepts a `--tool` flag to specify which tool to invoke
- Passes optional `--args` JSON string for tool parameters
- Prints the tool response to stdout for easy verification
- Uses the MCP HTTP transport to communicate with the server

Usage pattern:
```bash
bun test/mcp-test-client/index.ts --tool get-application-context
bun test/mcp-test-client/index.ts --tool list-files --args '{"path": "/path/to/folder"}'
```

## Capabilities

### New Capabilities
- **mcp-tool-tester**: A CLI tool that connects to the SMM MCP server and invokes tools on demand for testing and debugging purposes

### Modified Capabilities
- None - this is a new testing capability that doesn't change existing requirements

## Impact

- **New File**: `test/mcp-test-client/index.ts` - Main CLI entry point
- **Dependencies**: Add `@ai-sdk/mcp` and `@modelcontextprotocol/sdk` to the test client package
- **Existing Files Modified**: May need to update `test/mcp-test-client/package.json` and `test/mcp-test-client/tsconfig.json`
- **Integration**: Connects to the existing MCP server defined in `cli/src/mcp/mcp.ts`
