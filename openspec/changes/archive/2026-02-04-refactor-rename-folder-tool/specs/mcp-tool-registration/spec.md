# MCP Tool Registration - Delta Spec

This delta spec modifies the `mcp-tool-registration` capability to include the `rename-folder` tool in the unified tool pattern.

## MODIFIED Requirements

### Requirement: Rename Operation Tools Registered via Functions

The existing requirement is expanded to include the unified tool pattern.

**Original Text:**
```markdown
#### Scenario: Rename Operation Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `rename-folder` tool SHALL use `registerRenameFolderTool`
|- **AND** `begin-rename-task` tool SHALL use `registerBeginRenameTaskTool`
|- **AND** `add-rename-file` tool SHALL use `registerAddRenameFileTool`
|- **AND** `end-rename-task` tool SHALL use `registerEndRenameTaskTool`
```

**Updated Text:**
```markdown
#### Scenario: Rename Operation Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `rename-folder` tool SHALL use `registerRenameFolderTool`
|- **AND** `begin-rename-task` tool SHALL use `registerBeginRenameTaskTool`
|- **AND** `add-rename-file` tool SHALL use `registerAddRenameFileTool`
|- **AND** `end-rename-task` tool SHALL use `registerEndRenameTaskTool`
|- **AND** `rename-folder` tool SHALL use the unified tool pattern
```

## ADDED Requirements

### Requirement: Rename Folder Tool Follows Unified Pattern

The `rename-folder` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/renameFolder.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
|- **WHEN** the unified pattern is applied to `rename-folder`
|- **THEN** `cli/src/tools/renameFolder.ts` SHALL export:
  - `getTool(clientId?: string): ToolDefinition` - Core tool definition
  - `renameFolderAgentTool(clientId: string)` - AI Agent wrapper
  - `renameFolderMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
|- **WHEN** the AI Agent needs to use `rename-folder`
|- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.renameFolder(clientId, abortSignal)`
|- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
|- **WHEN** the MCP server needs to register `rename-folder`
|- **THEN** `cli/src/mcp/tools/renameFolderTool.ts` SHALL import from `mcpTools.renameFolder()`
|- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
|- **WHEN** the unified pattern is applied
|- **THEN** the MCP tool SHALL still be registered as `rename-folder`
|- **AND** the input schema SHALL remain unchanged (from and to parameters as strings)
|- **AND** the response format SHALL remain unchanged (JSON with renamed, from, to fields)

### Requirement: Unified Tool Pattern Extension

The unified tool pattern is extended to include the `rename-folder` tool.

#### Scenario: Rename Folder Uses Unified Pattern
|- **WHEN** the refactoring is complete
|- **THEN** `rename-folder` tool SHALL use the unified pattern
|- **AND** the base implementation SHALL be in `cli/src/tools/renameFolder.ts`
|- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/renameFolderTool.ts`
|- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.renameFolder` and `mcpTools.renameFolder`
|- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.renameFolder()`
