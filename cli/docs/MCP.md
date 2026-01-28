# MCP Server (get-media-folders)

The CLI exposes an MCP (Model Context Protocol) server that provides one tool: **get-media-folders**.

## Streamable HTTP (primary)

MCP is exposed via **Streamable HTTP** on the main SMM server.

### Running the server

Start the SMM server as usual:

```bash
bun run dev
```

or

```bash
bun run start
```

MCP is available at:

- **Base URL**: `http://localhost:<port>/mcp` (default port 30000)
- **Methods**: GET and POST as per the [MCP Streamable HTTP](https://spec.modelcontextprotocol.io/specification/2025-11-05/transports/streamable_http/) specification.

### Connecting from an MCP client

Configure your MCP client to use the Streamable HTTP URL. Example (Claude Desktop or other clients that support HTTP MCP):

- **URL**: `http://localhost:30000/mcp`

Use the same host/port if you changed them via `--port` or `PORT`. Session IDs are managed by the server (stateful mode).

## Optional: stdio transport

For subprocess-based clients (e.g. Claude Desktop with a command), a standalone stdio MCP server is also available:

```bash
bun run mcp
```

This runs only the MCP server over stdio (stdin/stdout). Do not write to stdout from the server; use stderr for logs.

## Tool: get-media-folders

- **Description**: Returns the SMM-managed media folder paths from user config (`userConfig.folders`).
- **Parameters**: None.
- **Success**: Returns a JSON array of folder path strings (platform-specific), e.g. `["C:\\Media\\TV", "/home/user/Media"]`.
- **Error**: If the config file is missing or invalid, the tool returns an error result (`isError: true`) with a message; it does not return a successful result.

Data is read from the same user config as the main SMM app (e.g. `%APPDATA%\SMM\smm.json` on Windows).
