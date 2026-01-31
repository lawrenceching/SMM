# MCP Server (Media Management Tools)

The CLI exposes an MCP (Model Context Protocol) server that provides comprehensive media management tools including file operations, metadata management, episode information, batch operations, and media recognition.

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

## Available Tools

### File Operations

#### Tool: is-folder-exist
- **Description**: Check if a folder exists at the specified path. Accepts paths in both POSIX and Windows format.
- **Parameters**:
  - `path` (string, required): The folder path to check
- **Success**: Returns JSON with `exists` (boolean) and optionally `reason` (string) if path exists but is not a directory
- **Error**: Returns error if path parameter is invalid

#### Tool: list-files
- **Description**: List files and folders in a directory with optional filtering
- **Parameters**:
  - `folderPath` (string, required): Path to the directory to list
  - `recursive` (boolean, optional): Whether to list files recursively (default: false)
  - `filter` (string, optional): Filter pattern for files/folders (supports wildcards)
- **Success**: Returns JSON with `files` array containing file/folder information
- **Error**: Returns error if folder doesn't exist, is not a directory, or path is invalid

### Media Metadata

#### Tool: get-media-metadata
- **Description**: Get media metadata for a folder. Returns cached metadata if it exists.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the media folder
- **Success**: Returns JSON containing the complete media metadata object
- **Error**: Returns error if folder doesn't exist, is not accessible, or path is invalid

#### Tool: write-media-metadata
- **Description**: Write or update media metadata for a folder. This will create or overwrite the metadata cache.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the media folder
  - `metadata` (object, required): The metadata object to write
- **Success**: Returns JSON with `success: true` and the written metadata path
- **Error**: Returns error if folder doesn't exist, metadata is invalid, or write fails

#### Tool: delete-media-metadata
- **Description**: Delete cached media metadata for a folder.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the media folder
- **Success**: Returns JSON with `success: true` and confirmation message
- **Error**: Returns error if folder path is invalid or deletion fails

### Episodes and Context

#### Tool: get-episodes
- **Description**: Get all episodes for a TV show media folder. Returns a flat array of all episodes across all seasons.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the TV show media folder
- **Success**: Returns JSON with `status: "success"`, `episodes` array, and `count` of episodes
- **Error**: Returns JSON with `status: "failure"` and error message if folder not found or metadata missing

#### Tool: get-application-context
- **Description**: Get application context including configured media folders and settings.
- **Parameters**: None
- **Success**: Returns JSON with `success: true` and `context` object containing:
  - `selectedAI`: Current AI provider selection
  - `applicationLanguage`: Application language setting
  - `folders`: Array of configured media folders
  - `selectedRenameRule`: Current rename rule selection
  - `tmdb`: TMDB configuration settings
- **Error**: Returns error if config file cannot be read

#### Tool: get-media-folders
- **Description**: Returns SMM-managed media folder paths from user config (`userConfig.folders`).
- **Parameters**: None.
- **Success**: Returns a JSON array of folder path strings (platform-specific), e.g. `["C:\\Media\\TV", "/home/user/Media"]`.
- **Error**: If config file is missing or invalid, tool returns an error result (`isError: true`) with a message; it does not return a successful result.

### Rename Operations

#### Tool: rename-folder
- **Description**: Rename a media folder. This is a destructive operation - the folder will be renamed on disk. Metadata cache files will also be updated.
- **Parameters**:
  - `from` (string, required): Current folder path
  - `to` (string, required): New folder path
- **Success**: Returns JSON with `renamed: true` and the actual `from` and `to` paths used
- **Error**: Returns JSON with `renamed: false` and error message, or tool error for system failures

#### Tool: begin-rename-task
- **Description**: Begin a batch rename task for a media folder. Returns a task ID that must be used for subsequent operations.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the media folder for batch rename
- **Success**: Returns JSON with `success: true`, `taskId`, and `mediaFolderPath`
- **Error**: Returns error if path is invalid or task creation fails

#### Tool: add-rename-file
- **Description**: Add a file rename operation to an existing task.
- **Parameters**:
  - `taskId` (string, required): ID of the existing rename task
  - `from` (string, required): Current file path
  - `to` (string, required): New file path
- **Success**: Returns JSON with `success: true` and `taskId`
- **Error**: Returns error if task doesn't exist, parameters are invalid, or add operation fails

#### Tool: end-rename-task
- **Description**: End a batch rename task and finalize the plan.
- **Parameters**:
  - `taskId` (string, required): ID of the rename task to finalize
- **Success**: Returns JSON with `success: true`, `taskId`, and `fileCount`
- **Error**: Returns JSON with `success: false` and error message if task not found or empty

### Recognize Operations

#### Tool: begin-recognize-task
- **Description**: Begin a media file recognition task for a media folder. Returns a task ID that must be used for subsequent operations.
- **Parameters**:
  - `mediaFolderPath` (string, required): Path to the media folder for recognition
- **Success**: Returns JSON with `success: true`, `taskId`, and `mediaFolderPath`
- **Error**: Returns error if path is invalid or task creation fails

#### Tool: add-recognized-file
- **Description**: Add a recognized file to an existing recognition task.
- **Parameters**:
  - `taskId` (string, required): ID of the existing recognition task
  - `season` (number, required): Season number
  - `episode` (number, required): Episode number
  - `path` (string, required): File path
- **Success**: Returns JSON with `success: true` and `taskId`
- **Error**: Returns error if task doesn't exist, parameters are invalid, or add operation fails

#### Tool: end-recognize-task
- **Description**: End a recognition task and finalize the plan.
- **Parameters**:
  - `taskId` (string, required): ID of the recognition task to finalize
- **Success**: Returns JSON with `success: true`, `taskId`, and `fileCount`
- **Error**: Returns error if task doesn't exist or finalization fails

## Batch Operation Workflow

Both rename and recognize tools follow a three-step batch operation pattern:

1. **Begin Task**: Create a new batch operation task and get a task ID
2. **Add Items**: Add individual files/operations to the task using the task ID
3. **End Task**: Finalize the task to execute the batch operation

This pattern allows for building complex operations with multiple files before execution, with validation at each step.

## Response Format

All tools return responses in the standard MCP format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON string with result data or error message"
    }
  ],
  "isError": true // Only present for errors
}
```

Success responses contain structured JSON data, while error responses have `isError: true` and descriptive error messages.

## Legacy Note

The original **get-media-folders** tool is still available for backward compatibility, but the newer **get-application-context** tool provides more comprehensive configuration information including the same folder data.
