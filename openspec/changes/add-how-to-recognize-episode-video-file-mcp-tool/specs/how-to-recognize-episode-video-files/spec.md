## ADDED Requirements

### Requirement: Tool returns recognition workflow instructions

The system SHALL provide an MCP tool named `how-to-recognize-episode-video-files` that returns instructions for the episode video file recognition workflow as markdown text.

#### Scenario: Tool returns instructions in Chinese
- **WHEN** the `how-to-recognize-episode-video-files` MCP tool is called with no parameters
- **THEN** the system SHALL return a response with a `text` field containing Chinese markdown instructions
- **AND** the response SHALL use the standard MCP tool response format

#### Scenario: Tool explains three-step recognition workflow
- **WHEN** the `how-to-recognize-episode-video-files` MCP tool is called
- **THEN** the instructions SHALL describe the three-step recognition process:
  1. Begin recognition task using `begin-recognize-task`
  2. Add recognized files using `add-recognized-media-file`
  3. End recognition task using `end-recognize-task`
- **AND** the instructions SHALL be in markdown format

### Requirement: Tool requires no input parameters

The `how-to-recognize-episode-video-files` tool SHALL NOT require any input parameters.

#### Scenario: Tool accepts empty input
- **WHEN** the `how-to-recognize-episode-video-files` MCP tool is called with an empty input object
- **THEN** the system SHALL accept the request
- **AND** the system SHALL process the request successfully

### Requirement: Tool description is localized

The system SHALL provide localized tool descriptions for the `how-to-recognize-episode-video-files` tool in all supported languages.

#### Scenario: Tool description in English
- **WHEN** the MCP server is initialized
- **THEN** the `how-to-recognize-episode-video-files` tool SHALL have an English description loaded from the i18n system
- **AND** the description SHALL be in English

#### Scenario: Tool description in Chinese
- **WHEN** the MCP server is initialized with Chinese locale
- **THEN** the `how-to-recognize-episode-video-files` tool SHALL have a Chinese description loaded from the i18n system
- **AND** the description SHALL be in Simplified Chinese

### Requirement: Tool is registered with MCP server

The system SHALL register the `how-to-recognize-episode-video-files` tool with the MCP server during initialization.

#### Scenario: Tool appears in MCP tool list
- **WHEN** the MCP server is initialized
- **THEN** the `how-to-recognize-episode-video-files` tool SHALL be registered
- **AND** the tool SHALL be available in the MCP server's tool list
- **AND** the tool SHALL be invocable through the MCP protocol

### Requirement: Tool follows existing MCP tool pattern

The `how-to-recognize-episode-video-files` tool implementation SHALL follow the same pattern as existing MCP tools like `how-to-rename-episode-video-files`.

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

The instruction content returned by the tool SHALL be stored as a static string constant in the source code.

#### Scenario: Content is loaded from constant
- **WHEN** the `how-to-recognize-episode-video-files` tool executes
- **THEN** the tool SHALL return content from a static constant
- **AND** the content SHALL NOT be loaded from external files or fetched from URLs
- **AND** the content SHALL be version-controlled with the source code

#### Scenario: Content can be updated by modifying code
- **WHEN** developers need to update the instruction content
- **THEN** they SHALL modify the constant in `cli/src/tools/howToRecognizeEpisodeVideoFiles.ts`
- **AND** the change SHALL take effect after rebuilding the CLI

### Requirement: Instructions include workflow example

The instruction content SHALL include a practical example demonstrating the three-step recognition workflow.

#### Scenario: Instructions contain example usage
- **WHEN** the instructions are reviewed
- **THEN** the instructions SHALL include an example showing:
  - How to call `begin-recognize-task` with a media folder path
  - How to add recognized files with season/episode numbers
  - How to call `end-recognize-task` to complete the workflow
- **AND** the example SHALL be easy to understand and follow
