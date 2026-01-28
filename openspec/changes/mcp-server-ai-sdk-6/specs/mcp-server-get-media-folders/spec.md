## ADDED Requirements

### Requirement: MCP server exposes get-media-folders tool

The cli module SHALL run an MCP server (using AI SDK 6) that exposes one tool named `get-media-folders`. The tool SHALL return the SMM-managed media folder paths, i.e. the value of `userConfig.folders` obtained from `getUserConfig()` in `cli/src/utils/config.ts`. Paths SHALL be returned in the same format as stored (platform-specific); the tool SHALL not accept parameters.

#### Scenario: Client calls get-media-folders and config has folders

- **WHEN** an MCP client invokes the `get-media-folders` tool
- **THEN** the server SHALL call `getUserConfig()` and return the `folders` array from the result
- **AND** the response SHALL contain exactly the paths stored in user config (no reordering, filtering, or format change)

#### Scenario: Client calls get-media-folders and config has no folders

- **WHEN** an MCP client invokes the `get-media-folders` tool and `userConfig.folders` is an empty array
- **THEN** the server SHALL return an empty list (e.g. `[]`) and SHALL NOT throw

#### Scenario: Config file missing or invalid

- **WHEN** an MCP client invokes the `get-media-folders` tool and `getUserConfig()` fails (e.g. file missing or invalid JSON)
- **THEN** the server SHALL report an error to the client (e.g. tool execution error) and SHALL NOT return a successful result
