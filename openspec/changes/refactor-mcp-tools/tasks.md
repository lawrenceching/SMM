# Tasks: Refactor MCP Tools Registration

## Overview

This document outlines the implementation tasks for refactoring MCP tools to use a consistent registration function pattern. Each task corresponds to adding a `registerXxxTool(server: McpServer)` function to the specified tool file.

## Task List

### Phase 1: File Operation Tools

#### Task: Add registration function to isFolderExistTool.ts

**File:** `cli/src/mcp/tools/isFolderExistTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerIsFolderExistTool(server: McpServer): void` function
4. The function should register tool with name `is-folder-exist`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleIsFolderExist(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerIsFolderExistTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to listFilesTool.ts

**File:** `cli/src/mcp/tools/listFilesTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerListFilesTool(server: McpServer): void` function
4. The function should register tool with name `list-files`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleListFiles(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerListFilesTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

### Phase 2: Media Metadata Tools

#### Task: Add registration function to getMediaMetadataTool.ts

**File:** `cli/src/mcp/tools/getMediaMetadataTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerGetMediaMetadataTool(server: McpServer): void` function
4. The function should register tool with name `get-media-metadata`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleGetMediaMetadata(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerGetMediaMetadataTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to writeMediaMetadataTool.ts

**File:** `cli/src/mcp/tools/writeMediaMetadataTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerWriteMediaMetadataTool(server: McpServer): void` function
4. The function should register tool with name `write-media-metadata`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleWriteMediaMetadata(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerWriteMediaMetadataTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to deleteMediaMetadataTool.ts

**File:** `cli/src/mcp/tools/deleteMediaMetadataTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerDeleteMediaMetadataTool(server: McpServer): void` function
4. The function should register tool with name `delete-media-metadata`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleDeleteMediaMetadata(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerDeleteMediaMetadataTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

### Phase 3: Episode and Context Tools

#### Task: Add registration function to getEpisodesTool.ts

**File:** `cli/src/mcp/tools/getEpisodesTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerGetEpisodesTool(server: McpServer): void` function
4. The function should register tool with name `get-episodes`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleGetEpisodes(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerGetEpisodesTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to getApplicationContextTool.ts

**File:** `cli/src/mcp/tools/getApplicationContextTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerGetApplicationContextTool(server: McpServer): void` function
4. The function should register tool with name `get-application-context`
5. Use the description from the commented-out code in `mcp.ts`
6. Handler should call `handleGetApplicationContext()` with no arguments

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerGetApplicationContextTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

### Phase 4: Rename Operation Tools

#### Task: Add registration function to renameFolderTool.ts

**File:** `cli/src/mcp/tools/renameFolderTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerRenameFolderTool(server: McpServer): void` function
4. The function should register tool with name `rename-folder`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleRenameFolder(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerRenameFolderTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to beginRenameTaskTool.ts

**File:** `cli/src/mcp/tools/beginRenameTaskTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerBeginRenameTaskTool(server: McpServer): void` function
4. The function should register tool with name `begin-rename-task`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleBeginRenameTask(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerBeginRenameTaskTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to addRenameFileTool.ts

**File:** `cli/src/mcp/tools/addRenameFileTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerAddRenameFileTool(server: McpServer): void` function
4. The function should register tool with name `add-rename-file`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleAddRenameFile(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerAddRenameFileTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to endRenameTaskTool.ts

**File:** `cli/src/mcp/tools/endRenameTaskTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerEndRenameTaskTool(server: McpServer): void` function
4. The function should register tool with name `end-rename-task`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleEndRenameTask(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerEndRenameTaskTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

### Phase 5: Recognize Operation Tools

#### Task: Add registration function to beginRecognizeTaskTool.ts

**File:** `cli/src/mcp/tools/beginRecognizeTaskTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerBeginRecognizeTaskTool(server: McpServer): void` function
4. The function should register tool with name `begin-recognize-task`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleBeginRecognizeTask(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerBeginRecognizeTaskTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to addRecognizedFileTool.ts

**File:** `cli/src/mcp/tools/addRecognizedFileTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerAddRecognizedFileTool(server: McpServer): void` function
4. The function should register tool with name `add-recognized-file`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleAddRecognizedFile(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerAddRecognizedFileTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

#### Task: Add registration function to endRecognizeTaskTool.ts

**File:** `cli/src/mcp/tools/endRecognizeTaskTool.ts`

**Steps:**
1. Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
2. Import `z` from `zod` (if not already imported)
3. Add `registerEndRecognizeTaskTool(server: McpServer): void` function
4. The function should register tool with name `end-recognize-task`
5. Use the description and input schema from the commented-out code in `mcp.ts`
6. Handler should call `handleEndRecognizeTask(args)` with proper typing

**Reference Pattern:** See `cli/src/mcp/tools/calculateTool.ts` for the expected structure

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Tool file exports `registerEndRecognizeTaskTool` function
- [ ] Function accepts `McpServer` parameter
- [ ] Tool is registered with correct name, description, and schema
- [ ] Existing tests continue to pass

### Phase 6: Update mcp.ts

#### Task: Replace inline registrations with registration function calls

**File:** `cli/src/mcp/mcp.ts`

**Steps:**
1. Add imports for all registration functions from tool files
2. Replace each commented-out `server.registerTool()` block with a call to the appropriate registration function
3. Maintain the same order of tool registration for consistency
4. Remove the commented-out registration code once replaced

**Imports to add:**
```typescript
import { registerIsFolderExistTool } from "./tools/isFolderExistTool";
import { registerListFilesTool } from "./tools/listFilesTool";
import { registerGetMediaMetadataTool } from "./tools/getMediaMetadataTool";
import { registerWriteMediaMetadataTool } from "./tools/writeMediaMetadataTool";
import { registerDeleteMediaMetadataTool } from "./tools/deleteMediaMetadataTool";
import { registerGetEpisodesTool } from "./tools/getEpisodesTool";
import { registerGetApplicationContextTool } from "./tools/getApplicationContextTool";
import { registerRenameFolderTool } from "./tools/renameFolderTool";
import { registerBeginRenameTaskTool } from "./tools/beginRenameTaskTool";
import { registerAddRenameFileTool } from "./tools/addRenameFileTool";
import { registerEndRenameTaskTool } from "./tools/endRenameTaskTool";
import { registerBeginRecognizeTaskTool } from "./tools/beginRecognizeTaskTool";
import { registerAddRecognizedFileTool } from "./tools/addRecognizedFileTool";
import { registerEndRecognizeTaskTool } from "./tools/endRecognizeTaskTool";
```

**Registration calls to add (after server creation):**
```typescript
registerCalculateTool(server);
registerGetMediaFoldersTool(server);
registerIsFolderExistTool(server);
registerListFilesTool(server);
registerGetMediaMetadataTool(server);
registerWriteMediaMetadataTool(server);
registerDeleteMediaMetadataTool(server);
registerGetEpisodesTool(server);
registerGetApplicationContextTool(server);
registerRenameFolderTool(server);
registerBeginRenameTaskTool(server);
registerAddRenameFileTool(server);
registerEndRenameTaskTool(server);
registerBeginRecognizeTaskTool(server);
registerAddRecognizedFileTool(server);
registerEndRecognizeTaskTool(server);
```

**Estimated Effort:** 30 minutes

**Verification:**
- [ ] All imports are added correctly
- [ ] All registration functions are called
- [ ] No duplicate tool registrations
- [ ] MCP server starts without errors
- [ ] All tools are discoverable via MCP protocol

### Phase 7: Update tools/index.ts

#### Task: Add registration function exports to tools/index.ts

**File:** `cli/src/mcp/tools/index.ts`

**Steps:**
1. Add exports for all registration functions alongside existing handler exports
2. Maintain alphabetical order for consistency

**Export format:**
```typescript
// Export registration functions
export { registerIsFolderExistTool } from "./isFolderExistTool";
export { registerListFilesTool } from "./listFilesTool";
// ... etc
```

**Estimated Effort:** 10 minutes

**Verification:**
- [ ] All registration functions are exported
- [ ] Exports are correctly formatted
- [ ] Existing handler exports still work

### Phase 8: Verification

#### Task: Run all existing unit tests

**Command:** `cd cli && bun test`

**Steps:**
1. Run all existing unit tests in the cli module
2. Verify that no tests are broken by the refactoring
3. Address any test failures by fixing the implementation

**Expected Result:** All existing tests pass

**Estimated Effort:** 10 minutes

**Verification:**
- [ ] All tests pass
- [ ] No regressions introduced

#### Task: Verify MCP server initialization

**Steps:**
1. Start the MCP server
2. Verify all tools are registered correctly
3. Check that tool list includes all expected tools

**Estimated Effort:** 15 minutes

**Verification:**
- [ ] Server starts without errors
- [ ] All 14 tools are registered
- [ ] Tool names match expected names
- [ ] Tool schemas are correct

#### Task: Clean up commented-out code in mcp.ts

**File:** `cli/src/mcp/mcp.ts`

**Steps:**
1. Remove all commented-out registration code blocks
2. Verify no useful comments are removed
3. Leave comments that provide context or explanation

**Estimated Effort:** 10 minutes

**Verification:**
- [ ] No commented-out registration code remains
- [ ] Code is cleaner and more readable
- [ ] Functionality is preserved

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: File Operation Tools | 2 tasks | 30 minutes |
| Phase 2: Media Metadata Tools | 3 tasks | 45 minutes |
| Phase 3: Episode and Context Tools | 2 tasks | 30 minutes |
| Phase 4: Rename Operation Tools | 4 tasks | 60 minutes |
| Phase 5: Recognize Operation Tools | 3 tasks | 45 minutes |
| Phase 6: Update mcp.ts | 1 task | 30 minutes |
| Phase 7: Update tools/index.ts | 1 task | 10 minutes |
| Phase 8: Verification | 3 tasks | 35 minutes |
| **Total** | **18 tasks** | **~5 hours** |

## Dependencies

- Phase 1 must complete before Phase 6
- Phase 2 must complete before Phase 6
- Phase 3 must complete before Phase 6
- Phase 4 must complete before Phase 6
- Phase 5 must complete before Phase 6
- Phases 1-5 can be done in parallel by different developers
- Phase 8 requires all previous phases to be complete

## Notes

- Each tool file already has the handler function implemented
- The registration function follows the pattern established by `calculateTool.ts` and `getMediaFoldersTool.ts`
- The commented-out code in `mcp.ts` provides the exact tool definitions to use
- No changes to tool names, parameters, or response formats are allowed
- All existing tests must continue to pass
