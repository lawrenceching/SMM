## 1. Refactor Base Tool Implementation

- [ ] 1.1 Create `cli/src/tools/listFiles.ts` with unified tool pattern
- [ ] 1.2 Add `getTool()` function following the `isFolderExist` pattern
- [ ] 1.3 Add `listFilesAgentTool()` function that wraps `getTool()` with clientId support
- [ ] 1.4 Add `listFilesMcpTool()` function that wraps `getTool()` without clientId
- [ ] 1.5 Move the complete implementation logic from MCP tool (path normalization, file listing, error handling)
- [ ] 1.6 Include `recursive` and `filter` parameters in the input schema
- [ ] 1.7 Create backward-compatible `listFilesTool` export

## 2. Update Tool Exports

- [ ] 2.1 Import `listFilesAgentTool` and `listFilesMcpTool` in `cli/src/tools/index.ts`
- [ ] 2.2 Add `listFiles: listFilesAgentTool` to the `agentTools` object
- [ ] 2.3 Add `listFiles: listFilesMcpTool` to the `mcpTools` object
- [ ] 2.4 Remove or deprecate `listFilesInMediaFolderTool` export from index.ts

## 3. Update MCP Wrapper

- [ ] 3.1 Update `cli/src/mcp/tools/listFilesTool.ts` to use `mcpTools.listFiles()` for tool definition
- [ ] 3.2 Keep the registration function `registerListFilesTool(server: McpServer): void`
- [ ] 3.3 Ensure the wrapper delegates to `mcpTools.listFiles()` similar to `isFolderExistTool.ts`

## 4. Update MCP Server Registration

- [ ] 4.1 Verify `cli/src/mcp/mcp.ts` imports from correct location `./tools/listFilesTool`
- [ ] 4.2 Verify the registration call uses the updated registration function

## 5. Update Chat Task

- [ ] 5.1 Update `cli/tasks/ChatTask.ts` to use `agentTools.listFiles(clientId)`
- [ ] 5.2 Replace the inline `{ ...listFilesInMediaFolderTool, execute: ... }` pattern with agent tool
- [ ] 5.3 Remove import of `listFilesInMediaFolderTool` from ChatTask.ts

## 6. Cleanup and Verification

- [ ] 6.1 Remove or deprecate `cli/src/tools/listFilesInMediaFolder.ts`
- [ ] 6.2 Run TypeScript compiler to verify no type errors
- [ ] 6.3 Verify MCP server can register the tool correctly
- [ ] 6.4 Verify AI Agent can use the tool via `agentTools.listFiles()`
- [ ] 6.5 Run existing unit tests to ensure no regressions
