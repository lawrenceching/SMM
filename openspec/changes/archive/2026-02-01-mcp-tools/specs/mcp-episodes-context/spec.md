# MCP Episode and Context Tools

This specification defines the MCP tools for episode retrieval and application context in SMM.

## ADDED Requirements

### Requirement: get-episodes tool

The MCP server SHALL provide a `get-episodes` tool that returns all episodes for a TV show media folder.

#### Scenario: Get episodes for known TV show

- **WHEN** the AI assistant calls `get-episodes` with a folder path that has cached metadata for a TV show
- **THEN** the tool SHALL return a flat array of all episodes with season number, episode number, and title

#### Scenario: Get episodes for unknown TV show

- **WHEN** the AI assistant calls `get-episodes` with a folder path that has no cached metadata
- **THEN** the tool SHALL return an error response indicating the TV show is unknown

#### Scenario: Get episodes for movie folder

- **WHEN** the AI assistant calls `get-episodes` with a folder path that is a movie (not TV show)
- **THEN** the tool SHALL return an error response indicating the folder is not a TV show

#### Scenario: Folder does not exist

- **WHEN** the AI assistant calls `get-episodes` with a path that does not exist
- **THEN** the tool SHALL return an error response indicating the folder was not found

### Requirement: get-application-context tool

The MCP server SHALL provide a `get-application-context` tool that returns basic application information.

#### Scenario: Get application context

- **WHEN** the AI assistant calls `get-application-context`
- **THEN** the tool SHALL return application configuration including configured media folders and selected rename rules

#### Scenario: Get application context when no folders configured

- **WHEN** the AI assistant calls `get-application-context` and no media folders are configured
- **THEN** the tool SHALL return an empty folders array

#### Scenario: Get application context when config unavailable

- **WHEN** the AI assistant calls `get-application-context` and the user configuration cannot be read
- **THEN** the tool SHALL return an error response indicating configuration failure
