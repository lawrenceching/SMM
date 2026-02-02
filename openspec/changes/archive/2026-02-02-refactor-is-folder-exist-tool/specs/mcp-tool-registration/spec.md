# MCP Tool Registration - Delta Spec

This delta spec modifies the `mcp-tool-registration` capability to include the `is-folder-exist` tool in the unified tool pattern.

## MODIFIED Requirements

### Requirement: Episode and Context Tools Registered via Functions

The existing requirement is expanded to include the `is-folder-exist` tool.

**Original Text:**
```markdown
#### Scenario: Episode and Context Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `get-episodes` tool SHALL use `registerGetEpisodesTool`
- **AND** `get-application-context` tool SHALL use `registerGetApplicationContextTool`
```

**Updated Text:**
```markdown
#### Scenario: Episode and Context Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `get-episodes` tool SHALL use `registerGetEpisodesTool`
- **AND** `get-application-context` tool SHALL use `registerGetApplicationContextTool`
- **AND** `is-folder-exist` tool SHALL use `registerIsFolderExistTool`
```

### Requirement: Unified Tool Pattern for Core Tools

A new requirement is added to define the unified tool pattern where tools are implemented in `cli/src/tools/` and exposed through both MCP and Agent interfaces.

#### Scenario: Unified Tool Pattern Structure
- **WHEN** a tool follows the unified pattern
- **THEN** the base implementation SHALL reside in `cli/src/tools/<toolName>.ts`
- **AND** the file SHALL export `getTool()`, `<ToolName>AgentTool()`, and `<ToolName>McpTool()` functions
- **AND** `cli/src/tools/index.ts` SHALL export these through `agentTools` and `mcpTools` objects
- **AND** the MCP wrapper in `cli/src/mcp/tools/<toolName>Tool.ts` SHALL delegate to `mcpTools.<toolName>()`

#### Scenario: Is Folder Exist Uses Unified Pattern
- **WHEN** the refactoring is complete
- **THEN** `is-folder-exist` tool SHALL use the unified pattern
- **AND** the base implementation SHALL be in `cli/src/tools/isFolderExist.ts`
- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/isFolderExistTool.ts`
- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.isFolderExist` and `mcpTools.isFolderExist`
- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.isFolderExist()`

## ADDED Requirements

### Requirement: Folder Existence Tools Follow Unified Pattern

The `is-folder-exist` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/isFolderExist.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
- **WHEN** the unified pattern is applied to `is-folder-exist`
- **THEN** `cli/src/tools/isFolderExist.ts` SHALL export:
  - `getTool(clientId?: string): ToolDefinition` - Core tool definition
  - `isFolderExistAgentTool(clientId: string)` - AI Agent wrapper
  - `isFolderExistMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
- **WHEN** the AI Agent needs to use `is-folder-exist`
- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.isFolderExist(clientId)`
- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
- **WHEN** the MCP server needs to register `is-folder-exist`
- **THEN** `cli/src/mcp/tools/isFolderExistTool.ts` SHALL import from `mcpTools.isFolderExist()`
- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
- **WHEN** the unified pattern is applied
- **THEN** the MCP tool SHALL still be registered as `is-folder-exist`
- **AND** the input schema SHALL remain unchanged (path parameter as string)
- **AND** the response format SHALL remain unchanged (JSON with exists, path, and reason fields)
