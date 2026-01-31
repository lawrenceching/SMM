# MCP Media Metadata Tools

This specification defines the MCP tools for media metadata operations in SMM.

## ADDED Requirements

### Requirement: get-media-metadata tool

The MCP server SHALL provide a `get-media-metadata` tool that reads cached media metadata for a folder.

#### Scenario: Metadata exists for folder

- **WHEN** the AI assistant calls `get-media-metadata` with a folder path that has cached metadata
- **THEN** the tool SHALL return the media metadata including type, TMDB ID, name, and seasons

#### Scenario: Metadata does not exist for folder

- **WHEN** the AI assistant calls `get-media-metadata` with a folder path that has no cached metadata
- **THEN** the tool SHALL return a success response indicating metadata was not found

#### Scenario: Folder does not exist

- **WHEN** the AI assistant calls `get-media-metadata` with a path that does not exist
- **THEN** the tool SHALL return an error response indicating the folder was not found

#### Scenario: Path is not a folder

- **WHEN** the AI assistant calls `get-media-metadata` with a path that is a file
- **THEN** the tool SHALL return an error response indicating the path is not a directory

### Requirement: write-media-metadata tool

The MCP server SHALL provide a `write-media-metadata` tool that writes media metadata to the cache.

#### Scenario: Write metadata successfully

- **WHEN** the AI assistant calls `write-media-metadata` with valid metadata for a folder
- **THEN** the tool SHALL save the metadata to the cache file and return success

#### Scenario: Write metadata with invalid data

- **WHEN** the AI assistant calls `write-media-metadata` with missing required fields
- **THEN** the tool SHALL return an error response indicating validation failure

#### Scenario: Write metadata to unwritable location

- **WHEN** the AI assistant calls `write-media-metadata` and the cache directory cannot be written
- **THEN** the tool SHALL return an error response indicating write failure

### Requirement: delete-media-metadata tool

The MCP server SHALL provide a `delete-media-metadata` tool that deletes cached metadata for a folder.

#### Scenario: Delete existing metadata

- **WHEN** the AI assistant calls `delete-media-metadata` with a folder path that has cached metadata
- **THEN** the tool SHALL delete the metadata file and return success

#### Scenario: Delete non-existent metadata

- **WHEN** the AI assistant calls `delete-media-metadata` with a folder path that has no cached metadata
- **THEN** the tool SHALL return an error response indicating metadata was not found

#### Scenario: Delete with invalid path

- **WHEN** the AI assistant calls `delete-media-metadata` with an empty or malformed path
- **THEN** the tool SHALL return an error response indicating invalid request
