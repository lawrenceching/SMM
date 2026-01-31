# MCP Rename Tools

This specification defines the MCP tools for file and folder renaming operations in SMM.

## ADDED Requirements

### Requirement: rename-folder tool

The MCP server SHALL provide a `rename-folder` tool that renames a media folder.

#### Scenario: Rename folder successfully

- **WHEN** the AI assistant calls `rename-folder` with valid source and destination paths
- **THEN** the tool SHALL rename the folder on disk and update related metadata

#### Scenario: Rename to existing folder name

- **WHEN** the AI assistant calls `rename-folder` with a destination path that already exists
- **THEN** the tool SHALL return an error response indicating the destination already exists

#### Scenario: Rename non-existent folder

- **WHEN** the AI assistant calls `rename-folder` with a source path that does not exist
- **THEN** the tool SHALL return an error response indicating the source folder was not found

#### Scenario: Rename with invalid paths

- **WHEN** the AI assistant calls `rename-folder` with empty or malformed paths
- **THEN** the tool SHALL return an error response indicating invalid input

### Requirement: begin-rename-task tool

The MCP server SHALL provide a `begin-rename-task` tool that starts a batch rename operation.

#### Scenario: Begin rename task successfully

- **WHEN** the AI assistant calls `begin-rename-task` with a valid media folder path
- **THEN** the tool SHALL create a new task and return a task ID

#### Scenario: Begin task for unrecognized folder

- **WHEN** the AI assistant calls `begin-rename-task` with a folder that has no cached metadata
- **THEN** the tool SHALL return an error response indicating the folder is not recognized

#### Scenario: Begin task for non-existent folder

- **WHEN** the AI assistant calls `begin-rename-task` with a path that does not exist
- **THEN** the tool SHALL return an error response indicating the folder was not found

### Requirement: add-rename-file tool

The MCP server SHALL provide an `add-rename-file` tool that adds a file to an existing rename task.

#### Scenario: Add file to task successfully

- **WHEN** the AI assistant calls `add-rename-file` with a valid task ID and from/to paths
- **THEN** the tool SHALL add the rename operation to the task and return success

#### Scenario: Add file to invalid task

- **WHEN** the AI assistant calls `add-rename-file` with a task ID that does not exist
- **THEN** the tool SHALL return an error response indicating the task was not found

#### Scenario: Add duplicate rename entry

- **WHEN** the AI assistant calls `add-rename-file` with the same from path twice
- **THEN** the tool SHALL return an error response indicating duplicate entry

### Requirement: end-rename-task tool

The MCP server SHALL provide an `end-rename-task` tool that finalizes a batch rename operation.

#### Scenario: End task with files successfully

- **WHEN** the AI assistant calls `end-rename-task` with a valid task ID containing at least one file
- **THEN** the tool SHALL finalize the task and return success

#### Scenario: End empty task

- **WHEN** the AI assistant calls `end-rename-task` with a task ID that has no files
- **THEN** the tool SHALL return an error response indicating no files in task

#### Scenario: End non-existent task

- **WHEN** the AI assistant calls `end-rename-task` with a task ID that does not exist
- **THEN** the tool SHALL return an error response indicating the task was not found
