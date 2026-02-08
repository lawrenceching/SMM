# README MCP Tool Capability

## Overview

The README MCP tool capability provides SMM users with access to documentation and usage guidelines through the MCP interface. This tool returns structured markdown content about SMM's capabilities, architecture, and usage patterns.

## Requirements

### Requirement: Tool returns README documentation

The system SHALL provide an MCP tool named `readme` that returns SMM's README documentation as markdown text.

#### Scenario: Tool returns empty content initially
- **WHEN** the `readme` MCP tool is called with no parameters
- **THEN** the system SHALL return a response with a `text` field containing an empty string
- **AND** the response SHALL use the standard MCP tool response format

#### Scenario: Tool returns markdown content
- **WHEN** the `readme` MCP tool is called with no parameters
- **THEN** the system SHALL return a response with a `text` field containing markdown-formatted documentation
- **AND** the content SHALL describe SMM's capabilities, architecture, and usage
- **AND** the response SHALL use the standard success response format

### Requirement: Tool requires no input parameters

The `readme` tool SHALL NOT require any input parameters.

#### Scenario: Tool accepts empty input
- **WHEN** the `readme` MCP tool is called with an empty input object
- **THEN** the system SHALL accept the request
- **AND** the system SHALL process the request successfully

### Requirement: Tool description is localized

The system SHALL provide localized tool descriptions for the `readme` tool in all supported languages.

#### Scenario: Tool description in English
- **WHEN** the MCP server is initialized
- **THEN** the `readme` tool SHALL have an English description loaded from the i18n system
- **AND** the description SHALL be in English

#### Scenario: Tool description in Chinese
- **WHEN** the MCP server is initialized with Chinese locale
- **THEN** the `readme` tool SHALL have a Chinese description loaded from the i18n system
- **AND** the description SHALL be in Simplified Chinese

### Requirement: Tool is registered with MCP server

The system SHALL register the `readme` tool with the MCP server during initialization.

#### Scenario: Tool appears in MCP tool list
- **WHEN** the MCP server is initialized
- **THEN** the `readme` tool SHALL be registered
- **AND** the tool SHALL be available in the MCP server's tool list
- **AND** the tool SHALL be invocable through the MCP protocol

### Requirement: Tool follows existing MCP tool pattern

The `readme` tool implementation SHALL follow the same pattern as existing MCP tools like `how-to-rename-episode-video-files`.

#### Scenario: Tool structure matches pattern
- **WHEN** the tool implementation is reviewed
- **THEN** the tool SHALL have a `getTool()` function that returns a `ToolDefinition`
- **AND** the tool SHALL have an `mcpTool()` export function
- **AND** the tool SHALL have a corresponding MCP wrapper file with `register*Tool()` function
- **AND** the tool SHALL be exported in `cli/src/tools/index.ts` under `mcpTools`

#### Scenario: Tool uses standard response format
- **WHEN** the tool executes successfully
- **THEN** the tool SHALL use `createSuccessResponse()` helper
- **AND** the response SHALL include both `data` and `error` fields
- **AND** the `error` field SHALL be null on success

### Requirement: Tool content is static

The README content returned by the tool SHALL be stored as a static string constant in the source code.

#### Scenario: Content is loaded from constant
- **WHEN** the `readme` tool executes
- **THEN** the tool SHALL return content from a `readmeContent` constant
- **AND** the content SHALL NOT be loaded from external files or fetched from URLs
- **AND** the content SHALL be version-controlled with the source code

#### Scenario: Content can be updated by modifying code
- **WHEN** developers need to update the README content
- **THEN** they SHALL modify the `readmeContent` constant in `cli/src/tools/readme.ts`
- **AND** the change SHALL take effect after rebuilding the CLI
