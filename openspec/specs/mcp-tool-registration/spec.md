# MCP Tool Registration

This specification defines the patterns and conventions for MCP tool registration in SMM.

## ADDED Requirements

### Requirement: Tool File SHALL Export Registration Function

Each MCP tool file located in `cli/src/mcp/tools/` SHALL export a registration function following the naming convention `register<ToolName>Tool(server: McpServer): void`.

The registration function SHALL call `server.registerTool()` with the tool definition including:
- Tool name as the first argument
- Tool schema object containing `description` and `inputSchema` properties
- Handler callback function that invokes the tool's handler

#### Scenario: Registration Function Follows Naming Convention
- **WHEN** a tool file is created or modified in `cli/src/mcp/tools/`
- **THEN** the file SHALL export a function named `register<ToolName>Tool` where `<ToolName>` matches the tool name in kebab-case converted to PascalCase
- **AND** the function SHALL accept a single parameter of type `McpServer`
- **AND** the function SHALL return `void`

#### Scenario: Registration Function Registers Tool with Correct Name
- **WHEN** `register<ToolName>Tool(server)` is called
- **THEN** the tool SHALL be registered with the name `<tool-name>` (kebab-case)
- **AND** the tool name SHALL match the name specified in the OpenSpec capability definition

#### Scenario: Registration Function Includes Description
- **WHEN** `register<ToolName>Tool(server)` is called
- **THEN** the tool registration SHALL include a `description` property explaining the tool's purpose
- **AND** the description SHALL be a string that helps users understand when to use the tool

#### Scenario: Registration Function Includes Input Schema
- **WHEN** `register<ToolName>Tool(server)` is called
- **THEN** the tool registration SHALL include an `inputSchema` property defining expected parameters
- **AND** the input schema SHALL use Zod schema format with `z.string()`, `z.number()`, etc.
- **AND** each parameter SHALL include a `.describe()` call for documentation

### Requirement: Registration Function Connects to Handler

The registration function SHALL connect the MCP server registration to the tool's handler function.

#### Scenario: Handler Receives Correct Arguments
- **WHEN** an MCP client invokes the tool
- **THEN** the handler callback SHALL receive an object matching the defined input schema
- **AND** the handler SHALL pass these arguments to the tool's handler function

#### Scenario: Handler Returns Standard Response Format
- **WHEN** the tool's handler function completes
- **THEN** the response SHALL conform to `McpToolResponse` interface:
  - `content`: Array of objects with `type: "text"` and `text` properties
  - `isError` (optional): Boolean indicating if the response is an error

#### Scenario: Handler Handles Errors Gracefully
- **WHEN** the tool's handler function throws an error
- **THEN** the registration callback SHALL catch the error
- **AND** return a response with `isError: true`
- **AND** include an error message in the response content

### Requirement: Tool File SHALL Export Handler Function

Each tool file SHALL export the handler function that implements the tool logic.

#### Scenario: Handler Function Exists
- **WHEN** a tool file is examined
- **THEN** the file SHALL export a function named `handle<ToolName>` that implements the tool logic
- **AND** the handler function SHALL return a `Promise<McpToolResponse>`

#### Scenario: Handler Function Accepts Parameters
- **WHEN** the handler function is called
- **THEN** it SHALL accept a single parameters object matching the tool's input schema
- **AND** the parameters object type SHALL be exported as `XxxParams` interface

### Requirement: Server Initialization Imports Registration Functions

The MCP server initialization code in `cli/src/mcp/mcp.ts` SHALL import and call registration functions.

#### Scenario: Registration Functions Are Imported
- **WHEN** `cli/src/mcp/mcp.ts` is examined
- **THEN** it SHALL import registration functions from each tool file
- **AND** imports SHALL follow the pattern `import { registerXxxTool } from "./tools/xxxTool"`

#### Scenario: Registration Functions Are Called During Server Setup
- **WHEN** the MCP server is being initialized
- **THEN** each tool's registration function SHALL be called with the server instance
- **AND** registration SHALL occur after server creation but before transport connection

### Requirement: Tool Exports Are Aggregated

The `cli/src/mcp/tools/index.ts` file SHALL export both handler and registration functions.

#### Scenario: Index Exports Registration Functions
- **WHEN** `cli/src/mcp/tools/index.ts` is examined
- **THEN** it SHALL export all registration functions from tool files
- **AND** exports SHALL follow the pattern `export * from "./xxxTool"`

#### Scenario: Index Maintains Backward Compatibility
- **WHEN** `cli/src/mcp/tools/index.ts` is modified
- **THEN** it SHALL continue to export handler functions
- **AND** existing imports from this index SHALL continue to work

### Requirement: Tools File Structure Follows Convention

Each tool file in `cli/src/mcp/tools/` SHALL follow a consistent file structure.

#### Scenario: File Contains Required Elements
- **WHEN** a tool file is created following the convention
- **THEN** the file SHALL contain, in order:
  1. Imports
  2. Parameters interface (exported, if applicable)
  3. Handler function (exported)
  4. Registration function (exported)

#### Scenario: Registration Uses Type-safe Schema
- **WHEN** `registerTool` is called
- **THEN** the input schema SHALL use type-safe schema definitions where available
- **AND** parameter types SHALL match the handler function signature

### Requirement: All Existing Tools Are Refactored

All existing MCP tools SHALL be refactored to use the registration function pattern.

#### Scenario: File Operation Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `is-folder-exist` tool SHALL use `registerIsFolderExistTool`
- **AND** `list-files` tool SHALL use `registerListFilesTool`

#### Scenario: Media Metadata Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `get-media-metadata` tool SHALL use `registerGetMediaMetadataTool`
- **AND** `write-media-metadata` tool SHALL use `registerWriteMediaMetadataTool`
- **AND** `delete-media-metadata` tool SHALL use `registerDeleteMediaMetadataTool`

#### Scenario: Episode and Context Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `get-episodes` tool SHALL use `registerGetEpisodesTool`
- **AND** `get-application-context` tool SHALL use `registerGetApplicationContextTool`
- **AND** `is-folder-exist` tool SHALL use `registerIsFolderExistTool`
- **AND** `list-files` tool SHALL use `registerListFilesTool`

#### Scenario: Rename Operation Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `rename-folder` tool SHALL use `registerRenameFolderTool`
- **AND** `begin-rename-task` tool SHALL use `registerBeginRenameTaskTool`
- **AND** `add-rename-file` tool SHALL use `registerAddRenameFileTool`
- **AND** `end-rename-task` tool SHALL use `registerEndRenameTaskTool`

#### Scenario: Recognize Operation Tools Registered via Functions
- **WHEN** the refactoring is complete
- **THEN** `begin-recognize-task` tool SHALL use `registerBeginRecognizeTaskTool`
- **AND** `add-recognized-file` tool SHALL use `registerAddRecognizedFileTool`
- **AND** `end-recognize-task` tool SHALL use `registerEndRecognizeTaskTool`

### Requirement: Unified Tool Pattern for Core Tools

A unified tool pattern is defined where tools are implemented in `cli/src/tools/` and exposed through both MCP and Agent interfaces.

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

### Requirement: List Files Tool Follows Unified Pattern

The `list-files` tool SHALL follow the unified tool pattern where the base implementation is in `cli/src/tools/listFiles.ts` and exposed through both MCP and AI Agent interfaces.

#### Scenario: Base Implementation in tools Directory
- **WHEN** the unified pattern is applied to `list-files`
- **THEN** `cli/src/tools/listFiles.ts` SHALL export:
  - `getTool(clientId?: string): ToolDefinition` - Core tool definition
  - `listFilesAgentTool(clientId: string)` - AI Agent wrapper
  - `listFilesMcpTool()` - MCP server wrapper

#### Scenario: Agent Access Through agentTools Object
- **WHEN** the AI Agent needs to use `list-files`
- **THEN** `cli/src/tasks/ChatTask.ts` SHALL access the tool via `agentTools.listFiles(clientId)`
- **AND** the tool SHALL be available in the tools configuration object passed to `streamText()`

#### Scenario: MCP Access Through mcpTools Object
- **WHEN** the MCP server needs to register `list-files`
- **THEN** `cli/src/mcp/tools/listFilesTool.ts` SHALL import from `mcpTools.listFiles()`
- **AND** the registration function SHALL use the tool definition from `mcpTools`

#### Scenario: Tool Name and Schema Preserved
- **WHEN** the unified pattern is applied
- **THEN** the MCP tool SHALL still be registered as `list-files`
- **AND** the input schema SHALL remain unchanged (folderPath parameter as string, optional recursive and filter)
- **AND** the response format SHALL remain unchanged (JSON with files array and count)

### Requirement: Unified Tool Pattern Extension

The unified tool pattern is extended to include the `list-files` tool.

#### Scenario: List Files Uses Unified Pattern
- **WHEN** the refactoring is complete
- **THEN** `list-files` tool SHALL use the unified pattern
- **AND** the base implementation SHALL be in `cli/src/tools/listFiles.ts`
- **AND** the MCP wrapper SHALL be in `cli/src/mcp/tools/listFilesTool.ts`
- **AND** `cli/src/tools/index.ts` SHALL export `agentTools.listFiles` and `mcpTools.listFiles`
- **AND** `cli/tasks/ChatTask.ts` SHALL use `agentTools.listFiles()`

### Requirement: Refactoring Preserves Tool Behavior

The refactoring SHALL NOT change the external behavior of any MCP tool.

#### Scenario: Tool Names Remain Unchanged
- **WHEN** the refactoring is complete
- **THEN** all tool names SHALL remain the same as before refactoring
- **AND** MCP clients SHALL continue to use the same tool names

#### Scenario: Tool Parameters Remain Unchanged
- **WHEN** the refactoring is complete
- **THEN** all tool input schemas SHALL remain identical to pre-refactoring
- **AND** MCP clients SHALL continue to send the same parameters

#### Scenario: Tool Responses Remain Unchanged
- **WHEN** the refactoring is complete
- **THEN** all tool response formats SHALL remain identical to pre-refactoring
- **AND** MCP clients SHALL continue to receive the same response structure

#### Scenario: Existing Tests Continue to Pass
- **WHEN** unit tests are run after refactoring
- **THEN** all existing tests SHALL pass without modification
- **AND** test coverage SHALL remain at least as comprehensive as before
