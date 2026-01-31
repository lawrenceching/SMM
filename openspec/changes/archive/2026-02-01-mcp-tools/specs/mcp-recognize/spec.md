# MCP Recognize Tools

This specification defines the MCP tools for media file recognition and identification in SMM.

## ADDED Requirements

### Requirement: begin-recognize-task tool

The MCP server SHALL provide a `begin-recognize-task` tool that starts a media file recognition task.

#### Scenario: Begin recognize task successfully

- **WHEN** the AI assistant calls `begin-recognize-task` with a valid media folder path
- **THEN** the tool SHALL create a new recognition task and return a task ID

#### Scenario: Begin task for non-existent folder

- **WHEN** the AI assistant calls `begin-recognize-task` with a path that does not exist
- **THEN** the tool SHALL return an error response indicating the folder was not found

#### Scenario: Begin task for file instead of folder

- **WHEN** the AI assistant calls `begin-recognize-task` with a path that is a file
- **THEN** the tool SHALL return an error response indicating the path is not a directory

### Requirement: add-recognized-file tool

The MCP server SHALL provide an `add-recognized-file` tool that adds a recognized media file to a task.

#### Scenario: Add recognized file successfully

- **WHEN** the AI assistant calls `add-recognized-file` with a valid task ID, season, episode, and file path
- **THEN** the tool SHALL add the file to the recognition task and return success

#### Scenario: Add file to invalid task

- **WHEN** the AI assistant calls `add-recognized-file` with a task ID that does not exist
- **THEN** the tool SHALL return an error response indicating the task was not found

#### Scenario: Add file with invalid episode info

- **WHEN** the AI assistant calls `add-recognized-file` with invalid season or episode numbers
- **THEN** the tool SHALL return an error response indicating invalid input

#### Scenario: Add file with non-existent path

- **WHEN** the AI assistant calls `add-recognized-file` with a file path that does not exist
- **THEN** the tool SHALL return an error response indicating the file was not found

### Requirement: end-recognize-task tool

The MCP server SHALL provide an `end-recognize-task` tool that finalizes a recognition task.

#### Scenario: End task with files successfully

- **WHEN** the AI assistant calls `end-recognize-task` with a valid task ID containing at least one file
- **THEN** the tool SHALL finalize the task and return success

#### Scenario: End empty task

- **WHEN** the AI assistant calls `end-recognize-task` with a task ID that has no files
- **THEN** the tool SHALL return an error response indicating no recognized files in task

#### Scenario: End non-existent task

- **WHEN** the AI assistant calls `end-recognize-task` with a task ID that does not exist
- **THEN** the tool SHALL return an error response indicating the task was not found

#### Scenario: Task completion notification

- **WHEN** the AI assistant successfully calls `end-recognize-task`
- **THEN** the tool SHALL return information about the number of files recognized
