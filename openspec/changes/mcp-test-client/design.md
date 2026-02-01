## Context

The Simple Media Manager (SMM) application exposes an MCP (Model Context Protocol) server with various tools for media management operations including file management, metadata operations, and renaming tasks. The MCP server is implemented in `cli/src/mcp/mcp.ts` and uses the `@modelcontextprotocol/sdk` with Streamable HTTP transport.

Currently, there is no standalone way to test individual MCP tools. Developers must either:
1. Run the full application and interact through the UI
2. Build custom test scripts for each tool they want to verify
3. Use generic MCP client tools that lack SMM-specific knowledge

This creates friction in development and debugging workflows.

## Goals / Non-Goals

**Goals:**
- Create a lightweight command-line tool to invoke any MCP tool exposed by the SMM server
- Support both simple tools (no parameters) and complex tools (with JSON parameters)
- Output tool responses in a readable format to stdout
- Use AI SDK 6's MCP client for seamless integration with the SMM MCP server
- Provide a familiar CLI interface with `--tool` and `--args` flags

**Non-Goals:**
- Build a full interactive REPL for MCP (use existing MCP clients for this)
- Implement any new SMM functionality (this is purely a testing tool)
- Support authentication or complex session management (basic HTTP transport only)
- Handle streaming responses or long-running operations
- Support SSE or WebSocket transports (only HTTP transport for simplicity)

## Decisions

### 1. Use AI SDK 6 MCP Client

**Decision:** Use `@ai-sdk/mcp` package for the MCP client implementation.

**Rationale:**
- Provides clean, high-level API for MCP client operations
- Built-in support for schema discovery and schema definition modes
- Handles transport layer automatically
- Future-proof integration with the broader AI SDK ecosystem
- Better type safety compared to raw MCP SDK usage

**Alternatives Considered:**
- Use raw `@modelcontextprotocol/sdk/client` - More verbose, requires manual transport handling
- Use a generic MCP CLI tool - Lacks SMM-specific configuration and defaults

### 2. HTTP Transport with Dynamic Session

**Decision:** Use HTTP transport with session ID management for stateless requests.

**Rationale:**
- HTTP transport is recommended for production use (per AI SDK documentation)
- Simpler to containerize and deploy compared to stdio
- Works well with the existing SMM MCP server configuration
- No need for persistent sessions in a CLI tool context

**Configuration:**
```typescript
const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'http://localhost:3000/mcp',
  },
});
```

### 3. CLI Interface Design

**Decision:** Use a simple flag-based interface with `--tool` for tool name and `--args` for JSON parameters.

**Rationale:**
- Matches common CLI patterns (like `curl`, `git`)
- Easy to script and integrate into CI/CD pipelines
- `--args` accepts JSON string for flexibility across different tool parameter structures

**Usage:**
```bash
bun test/mcp-test-client/index.ts --tool <tool-name>
bun test/mcp-test-client/index.ts --tool <tool-name> --args '{"param": "value"}'
```

### 4. Schema Discovery Mode

**Decision:** Use schema discovery mode (no explicit tool schemas defined).

**Rationale:**
- Automatically adapts to any tools the SMM server exposes
- No need to maintain tool schema definitions in the test client
- Simpler implementation - just pass tool name and arguments

**Trade-off:** Less IDE autocompletion, but acceptable for a testing/debugging tool

### 5. Response Formatting

**Decision:** Print the raw tool result content to stdout in a readable format.

**Rationale:**
- Easy to parse in scripts
- Can be piped to other tools (jq, grep, etc.)
- Preserves all information from the MCP response

**Output Format:**
- Success: Print the tool result content
- Error: Print error message to stderr and exit with code 1

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP server not running | Tool fails to connect | Add clear error message indicating server must be running |
| Invalid JSON in `--args` | Parsing error | Validate JSON before sending to server |
| Unknown tool name | Server returns error | Display available tools if tool not found |
| Network connectivity | Request timeout/failure | Add timeout and connection error handling |

## Migration Plan

This is a new testing tool with no migration concerns. The existing MCP server continues to function unchanged.

## Open Questions

1. **Default server URL**: Should we use `localhost:3000` or make it configurable via environment variable?
2. **Tool listing**: Should we add a `--list` flag to display all available tools?
