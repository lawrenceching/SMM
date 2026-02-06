# MCP Tool Registration - Delta Spec

This delta spec modifies the `mcp-tool-registration` capability to include the `get-media-folders` tool in the unified tool pattern.

## MODIFIED Requirements

### Requirement: Episode and Context Tools Registered via Functions

The existing requirement is expanded to include the `get-media-folders` tool.

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
- **AND** `get-media-folders` tool SHALL use `registerGetMediaFoldersTool`
```

### Requirement: Unified Tool Pattern for Core Tools

A new requirement is added to define the unified tool pattern where tools are implemented in `cli/src/tools/` and exposed through both MCP and Agent interfaces.

#### Scenario: Unified Tool Pattern Structure
- **WHEN** a tool follows the unified pattern
- **THEN** the base implementation SHALL reside in `cli/src/tools/<toolName>.ts`
- **AND** the file SHALL export `getTool()`, `<ToolName>AgentTool()`, and `<ToolName>McpTool()` functions
- **AND** `cli/src/tools/index.ts` SHALL export these through `agentTools` and `mcpTools` objects
- **AND** the MCP wrapper in `cli/src/mcp/tools/<toolName>Tool.ts` SHALL delegate to `mcpTools.<toolName>()`

#### Scenario: Get Media Folders Uses Unified Pattern
- **WHEN** the refactoring is complete
- **THEN** `get-media-folders` tool SHALL use the unified pattern
- **AND** the base implementation SHALL be in `cli/src/tools/getMediaFolders.ts`
- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/getMediaFoldersTool.ts`
- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.getMediaFolders` and `mcpTools.getMediaFolders`
- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.getMediaFolders()`
- **AND** the old implementation at `cli/src/mcp/getMediaFoldersTool.ts` SHALL be removed

## ADDED Requirements

### Requirement: Media Folder Tools Follow Unified Pattern

The `get-media-folders` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/getMediaFolders.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
- **WHEN** the unified pattern is applied to `get-media-folders`
- **THEN** `cli/src/tools/getMediaFolders.ts` SHALL export:
  - `getTool(clientId?: string): ToolDefinition` - Core tool definition
  - `getMediaFoldersAgentTool(clientId: string)` - AI Agent wrapper
  - `getMediaFoldersMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
- **WHEN** the AI Agent needs to use `get-media-folders`
- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.getMediaFolders(clientId)`
- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
- **WHEN** the MCP server needs to register `get-media-folders`
- **THEN** `cli/src/mcp/tools/getMediaFoldersTool.ts` SHALL import from `mcpTools.getMediaFolders()`
- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
- **WHEN** the unified pattern is applied
- **THEN** the MCP tool SHALL still be registered as `get-media-folders`
- **AND** the input schema SHALL remain unchanged (empty object `{}`)
- **AND** the response format SHALL remain unchanged (JSON array of folder paths)
