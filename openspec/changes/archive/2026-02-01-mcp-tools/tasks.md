## 1. Infrastructure Setup

- [x] 1.1 Create tool handler directory structure (`cli/src/mcp/tools/`)
- [x] 1.2 Create base MCP tool handler pattern template
- [x] 1.3 Create task storage module for batch operations (reuses existing plan storage from renameFilesToolV2 and recognizeMediaFilesTool)

## 2. File Operations Tools

- [x] 2.1 Implement `isFolderExistTool` handler in `cli/src/mcp/tools/isFolderExistTool.ts`
- [x] 2.2 Implement `listFilesTool` handler in `cli/src/mcp/tools/listFilesTool.ts`
- [x] 2.3 Create unit tests for `isFolderExistTool` handler
- [x] 2.4 Create unit tests for `listFilesTool` handler

## 3. Media Metadata Tools

- [x] 3.1 Implement `getMediaMetadataTool` handler in `cli/src/mcp/tools/getMediaMetadataTool.ts`
- [x] 3.2 Implement `writeMediaMetadataTool` handler in `cli/src/mcp/tools/writeMediaMetadataTool.ts`
- [x] 3.3 Implement `deleteMediaMetadataTool` handler in `cli/src/mcp/tools/deleteMediaMetadataTool.ts`
- [x] 3.4 Create unit tests for `getMediaMetadataTool` handler
- [x] 3.5 Create unit tests for `writeMediaMetadataTool` handler
- [x] 3.6 Create unit tests for `deleteMediaMetadataTool` handler

## 4. Episode and Context Tools

- [x] 4.1 Implement `getEpisodesTool` handler in `cli/src/mcp/tools/getEpisodesTool.ts`
- [x] 4.2 Implement `getApplicationContextTool` handler in `cli/src/mcp/tools/getApplicationContextTool.ts`
- [x] 4.3 Create unit tests for `getEpisodesTool` handler
- [x] 4.4 Create unit tests for `getApplicationContextTool` handler

## 5. Rename Tools

- [x] 5.1 Implement `renameFolderTool` handler in `cli/src/mcp/tools/renameFolderTool.ts`
- [x] 5.2 Implement `beginRenameTaskTool` handler in `cli/src/mcp/tools/beginRenameTaskTool.ts`
- [x] 5.3 Implement `addRenameFileTool` handler in `cli/src/mcp/tools/addRenameFileTool.ts`
- [x] 5.4 Implement `endRenameTaskTool` handler in `cli/src/mcp/tools/endRenameTaskTool.ts`
- [x] 5.5 Create unit tests for `renameFolderTool` handler
- [x] 5.6 Create unit tests for rename batch task handlers

## 6. Recognize Tools

- [x] 6.1 Implement `beginRecognizeTaskTool` handler in `cli/src/mcp/tools/beginRecognizeTaskTool.ts`
- [x] 6.2 Implement `addRecognizedFileTool` handler in `cli/src/mcp/tools/addRecognizedFileTool.ts`
- [x] 6.3 Implement `endRecognizeTaskTool` handler in `cli/src/mcp/tools/endRecognizeTaskTool.ts`
- [x] 6.4 Create unit tests for recognize task handlers

## 7. Server Registration Updates

- [x] 7.1 Update `cli/src/mcp/streamableHttp.ts` to register file operation tools
- [x] 7.2 Update `cli/src/mcp/streamableHttp.ts` to register media metadata tools
- [x] 7.3 Update `cli/src/mcp/streamableHttp.ts` to register episode and context tools
- [x] 7.4 Update `cli/src/mcp/streamableHttp.ts` to register rename tools
- [x] 7.5 Update `cli/src/mcp/streamableHttp.ts` to register recognize tools
- [x] 7.6 Update `cli/src/mcp/server.ts` to register all new tools (stdio transport)
- [x] 7.7 Export all tool handlers from `cli/src/mcp/tools/index.ts`

## 8. Integration Testing

- [x] 8.1 Test MCP server starts with all tools registered
- [x] 8.2 Test tool discovery via MCP protocol
- [x] 8.3 Test file operation tools with real file system
- [x] 8.4 Test metadata tools with real metadata cache
- [x] 8.5 Test batch operation task lifecycle

## 9. Documentation

- [x] 9.1 Update `cli/docs/MCP.md` with new tool documentation
- [x] 9.2 Add tool descriptions and parameters to each tool handler file
- [x] 9.3 Create example usage documentation for complex tools (batch operations)

## 10. Verification

- [x] 10.1 Run all unit tests and ensure pass
- [x] 10.2 Verify all tools are registered correctly
- [x] 10.3 Test end-to-end with MCP client
- [x] 10.4 Verify implementation matches specifications
