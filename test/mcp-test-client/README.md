# MCP Tool Tester

A command-line tool for testing and debugging the SMM MCP server.

## Overview

This tool allows you to invoke any MCP tool exposed by the SMM server directly from the command line. It's useful for:

- Testing MCP tool functionality without the full UI
- Debugging tool responses
- Verifying MCP server connectivity
- Scripting automated tests

## Usage

```bash
bun test/mcp-test-client/index.ts --tool <tool-name> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--tool <name>` | Name of the MCP tool to invoke (required) |
| `--args <json>` | JSON string containing tool parameters (optional) |
| `--help` | Show usage information |

### Examples

Invoke a tool with no parameters:

```bash
bun test/mcp-test-client/index.ts --tool get-application-context
```

Invoke a tool with parameters:

```bash
bun test/mcp-test-client/index.ts --tool list-files --args '{"path": "C:/Users/lawrence/Movies"}'
```

Invoke a tool with multiple parameters:

```bash
bun test/mcp-test-client/index.ts --tool is-folder-exist --args '{"path": "C:/Users/lawrence/Movies/TV Shows"}'
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMM_MCP_URL` | MCP server URL | `http://localhost:3000/mcp` |

Example with custom URL:

```bash
SMM_MCP_URL=http://localhost:4000/mcp bun test/mcp-test-client/index.ts --tool get-application-context
```

## Available Tools

Once connected to the MCP server, you can invoke any of these tools:

### File Operations

- `list-files` - List files in a directory
- `is-folder-exist` - Check if a folder exists

### Media Metadata

- `get-media-metadata` - Get metadata for a media file
- `write-media-metadata` - Write metadata for a media file
- `delete-media-metadata` - Delete metadata for a media file

### Media Folders

- `get-media-folders` - Get list of configured media folders

### Episodes

- `get-episodes` - Get episodes for a TV show

### Application Context

- `get-application-context` - Get the current application context

### Rename Operations

- `rename-folder` - Rename a folder
- `begin-rename-task` - Start a rename task
- `add-rename-file` - Add a file to rename task
- `end-rename-task` - Complete a rename task

### Recognize Operations

- `begin-recognize-task` - Start a recognize task
- `add-recognized-file` - Add a recognized file
- `end-recognize-task` - Complete a recognize task

### Utilities

- `calculate` - Perform calculations

### Error Handling

If a tool invocation fails, the tool will print an error message and exit with code 1:

```bash
$ bun test/mcp-test-client/index.ts --tool nonexistent-tool
Error: Tool 'nonexistent-tool' not found
Exit code: 1
```

If the MCP server is not running:

```bash
$ bun test/mcp-test-client/index.ts --tool get-application-context
Error: Unable to connect. Is the computer able to access the url?
Exit code: 1
```

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
cd test/mcp-test-client
bun install
```

## Running Without Prefix

You can also run the tool directly using the bin script:

```bash
bun run test/mcp-test-client/index.ts --help
```

Or add it to your PATH for global access (Unix-like systems only):

```bash
chmod +x test/mcp-test-client/index.ts
./test/mcp-test-client/index.ts --help
```

## Requirements

- Bun runtime
- SMM MCP server running at the specified URL
- Network access to the MCP server

## References

- [AI SDK MCP Documentation](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
