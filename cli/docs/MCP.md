# MCP Server (get-media-folders)

The CLI exposes an MCP (Model Context Protocol) server that provides one tool: **get-media-folders**.

## Streamable HTTP on a separate port

MCP is exposed via **Streamable HTTP** on its own host and port, configured in user config. It is **not** served on the main SMM app port.

### User config

Settings are stored in user config (e.g. `smm.json`). You can change them in the UI under **Settings → General**:

- **enableMcpServer** (boolean): When `true`, the MCP server is started on the given host and port. Default: `false`.
- **mcpHost** (string): Host to bind (e.g. `127.0.0.1`). Default: `127.0.0.1`.
- **mcpPort** (number): Port to listen on (e.g. `30001`). Default: `30001`.

After you save settings, the config file is written and the CLI applies the new MCP config: it stops the current MCP server (if any) and starts a new one when `enableMcpServer` is true. No app restart is required.

### Running the server

Start the SMM server as usual:

```bash
bun run dev
```

or

```bash
bun run start
```

If **Enable MCP server** is on in settings, MCP is available at:

- **Base URL**: `http://<mcpHost>:<mcpPort>` (default `http://127.0.0.1:30001`)
- **Methods**: GET and POST as per the [MCP Streamable HTTP](https://spec.modelcontextprotocol.io/specification/2025-11-05/transports/streamable_http/) specification.

### Connecting from an MCP client

Configure your MCP client with the Streamable HTTP URL using the host and port from user config, for example:

- **URL**: `http://127.0.0.1:30001` (when using defaults)

The server runs in **stateless mode** (no session ID). Each request is independent, which avoids "Server already initialized" errors when clients reconnect or do not send session IDs.

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
