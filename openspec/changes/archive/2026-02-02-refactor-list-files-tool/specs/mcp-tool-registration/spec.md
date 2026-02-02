# MCP Tool Registration - Delta Spec

This delta spec modifies the `mcp-tool-registration` capability to include the `list-files` tool in the unified tool pattern.

## MODIFIED Requirements

### Requirement: Episode and Context Tools Registered via Functions

The existing requirement is expanded to include the `list-files` tool.

**Original Text:**
```markdown
#### Scenario: Episode and Context Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `get-episodes` tool SHALL use `registerGetEpisodesTool`
|- **AND** `get-application-context` tool SHALL use `registerGetApplicationContextTool`
|- **AND** `is-folder-exist` tool SHALL use `registerIsFolderExistTool`
```

**Updated Text:**
```markdown
#### Scenario: Episode and Context Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `get-episodes` tool SHALL use `registerGetEpisodesTool`
|- **AND** `get-application-context` tool SHALL use `registerGetApplicationContextTool`
|- **AND** `is-folder-exist` tool SHALL use `registerIsFolderExistTool`
|- **AND** `list-files` tool SHALL use `registerListFilesTool`
```

## ADDED Requirements

### Requirement: List Files Tool Follows Unified Pattern

The `list-files` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/listFiles.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
|- **WHEN** the unified pattern is applied to `list-files`
|- **THEN** `cli/src/tools/listFiles.ts` SHALL export:
  - `getTool(clientId?: string): ToolDefinition` - Core tool definition
  - `listFilesAgentTool(clientId: string)` - AI Agent wrapper
  - `listFilesMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
|- **WHEN** the AI Agent needs to use `list-files`
|- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.listFiles(clientId)`
|- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
|- **WHEN** the MCP server needs to register `list-files`
|- **THEN** `cli/src/mcp/tools/listFilesTool.ts` SHALL import from `mcpTools.listFiles()`
|- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
|- **WHEN** the unified pattern is applied
|- **THEN** the MCP tool SHALL still be registered as `list-files`
|- **AND** the input schema SHALL remain unchanged (folderPath parameter as string, optional recursive and filter)
|- **AND** the response format SHALL remain unchanged (JSON with files array and count)

### Requirement: Unified Tool Pattern Extension

The unified tool pattern is extended to include the `list-files` tool.

#### Scenario: List Files Uses Unified Pattern
|- **WHEN** the refactoring is complete
|- **THEN** `list-files` tool SHALL use the unified pattern
|- **AND** the base implementation SHALL be in `cli/src/tools/listFiles.ts`
|- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/listFilesTool.ts`
|- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.listFiles` and `mcpTools.listFiles`
|- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.listFiles()`
