# MCP File Operations Tools

This specification defines the MCP tools for file and folder operations in SMM.

## ADDED Requirements

### Requirement: is-folder-exist tool

The MCP server SHALL provide an `is-folder-exist` tool that checks whether a folder exists at the specified path.

#### Scenario: Folder exists

- **WHEN** the AI assistant calls `is-folder-exist` with a valid path that exists as a directory
- **THEN** the tool SHALL return a success response with `{ "exists": true }`

#### Scenario: Folder does not exist

- **WHEN** the AI assistant calls `is-folder-exist` with a path that does not exist
- **THEN** the tool SHALL return a success response with `{ "exists": false }`

#### Scenario: Path is a file, not a folder

- **WHEN** the AI assistant calls `is-folder-exist` with a path that exists but is a file
- **THEN** the tool SHALL return a success response with `{ "exists": false }`

#### Scenario: Invalid path format

- **WHEN** the AI assistant calls `is-folder-exist` with an empty or malformed path
- **THEN** the tool SHALL return an error response with an appropriate error message

### Requirement: list-files tool

The MCP server SHALL provide a `list-files` tool that lists all files in a media folder recursively.

#### Scenario: List files in existing folder

- **WHEN** the AI assistant calls `list-files` with a valid folder path that exists
- **THEN** the tool SHALL return a JSON array of file paths relative to the folder

#### Scenario: List files in empty folder

- **WHEN** the AI assistant calls `list-files` with a valid folder path that is empty
- **THEN** the tool SHALL return an empty JSON array `[]`

#### Scenario: Folder does not exist

- **WHEN** the AI assistant calls `list-files` with a path that does not exist
- **THEN** the tool SHALL return an error response indicating the folder was not found

#### Scenario: Path is not a folder

- **WHEN** the AI assistant calls `list-files` with a path that is a file
- **THEN** the tool SHALL return an error response indicating the path is not a directory
