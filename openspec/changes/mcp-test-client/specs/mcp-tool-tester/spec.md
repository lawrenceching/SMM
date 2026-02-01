## ADDED Requirements

### Requirement: CLI can invoke MCP tools by name

The MCP tool tester SHALL accept a `--tool` flag specifying the name of the MCP tool to invoke.

#### Scenario: Invoke tool with no parameters
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool get-application-context`
- **THEN** the tool SHALL connect to the MCP server at `http://localhost:3000/mcp`
- **THEN** the tool SHALL invoke the `get-application-context` tool
- **THEN** the tool SHALL print the result to stdout
- **THEN** the tool SHALL exit with code 0 on success

#### Scenario: Invoke unknown tool
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool nonexistent-tool`
- **THEN** the tool SHALL attempt to invoke the tool
- **THEN** the tool SHALL print an error message indicating the tool was not found
- **THEN** the tool SHALL exit with code 1

### Requirement: CLI can pass parameters to tools

The MCP tool tester SHALL accept an optional `--args` flag with a JSON string containing tool parameters.

#### Scenario: Invoke tool with JSON parameters
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool list-files --args '{"path": "/path/to/folder"}'`
- **THEN** the tool SHALL parse the JSON string `{"path": "/path/to/folder"}`
- **THEN** the tool SHALL invoke the `list-files` tool with the provided parameters
- **THEN** the tool SHALL print the result to stdout
- **THEN** the tool SHALL exit with code 0 on success

#### Scenario: Invalid JSON in --args
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool list-files --args 'not-valid-json'`
- **THEN** the tool SHALL detect the invalid JSON
- **THEN** the tool SHALL print an error message about invalid JSON
- **THEN** the tool SHALL exit with code 1

#### Scenario: Missing required parameter
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool list-files` without `--args`
- **THEN** the tool SHALL invoke the `list-files` tool
- **THEN** the tool SHALL print an error from the MCP server about missing required parameter
- **THEN** the tool SHALL exit with code 1

### Requirement: CLI handles connection errors

The MCP tool tester SHALL handle connection errors gracefully and provide clear error messages.

#### Scenario: MCP server not running
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool get-application-context` but the MCP server is not available
- **THEN** the tool SHALL attempt to connect to `http://localhost:3000/mcp`
- **THEN** the tool SHALL detect the connection failure
- **THEN** the tool SHALL print an error message indicating the server is not available
- **THEN** the tool SHALL exit with code 1

#### Scenario: Network timeout
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool get-application-context` and the server is unresponsive
- **THEN** the tool SHALL attempt to connect with a reasonable timeout
- **THEN** the tool SHALL print a timeout error message
- **THEN** the tool SHALL exit with code 1

### Requirement: CLI outputs tool results

The MCP tool tester SHALL output tool results in a readable format.

#### Scenario: Successful tool invocation
- **WHEN** user runs `bun test/mcp-test-client/index.ts --tool get-application-context`
- **THEN** the tool SHALL receive the tool result from the MCP server
- **THEN** the tool SHALL print the result content to stdout as JSON
- **THEN** the tool SHALL exit with code 0

#### Scenario: Tool returns error
- **WHEN** user invokes a tool that returns an error (e.g., invalid path)
- **THEN** the tool SHALL receive the error response from the MCP server
- **THEN** the tool SHALL print the error message to stdout
- **THEN** the tool SHALL exit with code 1

### Requirement: CLI supports help and usage information

The MCP tool tester SHALL provide help information when requested.

#### Scenario: Display help
- **WHEN** user runs `bun test/mcp-test-client/index.ts --help`
- **THEN** the tool SHALL print usage information including:
  - Available flags (`--tool`, `--args`, `--help`)
  - Example usage
  - Default MCP server URL
- **THEN** the tool SHALL exit with code 0
