# MCP Tool Registration - Delta Spec

This delta spec modifies the `mcp-tool-registration` capability to include the `get-media-metadata` tool in the unified tool pattern.

## MODIFIED Requirements

### Requirement: File Operation Tools Registered via Functions

The existing requirement is expanded to include the `get-media-metadata` tool.

**Original Text:**
```markdown
#### Scenario: File Operation Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `read-file` tool SHALL use `registerReadFileTool`
|- **AND** `write-file` tool SHALL use `registerWriteFileTool`
|- **AND** `list-files` tool SHALL use `registerListFilesTool`
```

**Updated Text:**
```markdown
#### Scenario: File Operation Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `read-file` tool SHALL use `registerReadFileTool`
|- **AND** `write-file` tool SHALL use `registerWriteFileTool`
|- **AND** `list-files` tool SHALL use `registerListFilesTool`
|- **AND** `get-media-metadata` tool SHALL use `registerGetMediaMetadataTool`
```

### Requirement: Media Metadata Tools Registered via Functions

The existing requirement is expanded to include the `get-media-metadata` tool.

**Original Text:**
```markdown
#### Scenario: Media Metadata Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `get-media-metadata` tool SHALL use `registerGetMediaMetadataTool`
|- **AND** `write-media-metadata` tool SHALL use `registerWriteMediaMetadataTool`
|- **AND** `delete-media-metadata` tool SHALL use `registerDeleteMediaMetadataTool`
```

**Updated Text:**
```markdown
#### Scenario: Media Metadata Tools Registered via Functions
|- **WHEN** the refactoring is complete
|- **THEN** `get-media-metadata` tool SHALL use `registerGetMediaMetadataTool`
|- **AND** `write-media-metadata` tool SHALL use `registerWriteMediaMetadataTool`
|- **AND** `delete-media-metadata` tool SHALL use `registerDeleteMediaMetadataTool`
|- **AND** `get-media-metadata` tool SHALL use the unified tool pattern
```

## ADDED Requirements

### Requirement: Media Metadata Tool Follows Unified Pattern

The `get-media-metadata` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/getMediaMetadata.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
|- **WHEN** the unified pattern is applied to `get-media-metadata`
|- **THEN** `cli/src/tools/getMediaMetadata.ts` SHALL export:
  - `getTool(abortSignal?: AbortSignal): ToolDefinition` - Core tool definition
  - `getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal)` - AI Agent wrapper
  - `getMediaMetadataMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
|- **WHEN** the AI Agent needs to use `get-media-metadata`
|- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.getMediaMetadata(clientId, abortSignal)`
|- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
|- **WHEN** the MCP server needs to register `get-media-metadata`
|- **THEN** `cli/src/mcp/tools/getMediaMetadataTool.ts` SHALL import from `mcpTools.getMediaMetadata()`
|- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
|- **WHEN** the unified pattern is applied
|- **THEN** the MCP tool SHALL still be registered as `get-media-metadata`
|- **AND** the input schema SHALL remain unchanged (mediaFolderPath parameter as string)
|- **AND** the response format SHALL remain unchanged (JSON with found, metadata, and files fields)

### Requirement: Unified Tool Pattern Extension

The unified tool pattern is extended to include the `get-media-metadata` tool.

#### Scenario: Get Media Metadata Uses Unified Pattern
|- **WHEN** the refactoring is complete
|- **THEN** `get-media-metadata` tool SHALL use the unified pattern
|- **AND** the base implementation SHALL be in `cli/src/tools/getMediaMetadata.ts`
|- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/getMediaMetadataTool.ts`
|- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.getMediaMetadata` and `mcpTools.getMediaMetadata`
|- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.getMediaMetadata()`
