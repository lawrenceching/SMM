## 1. Refactor Base Tool Implementation

- [ ] 1.1 Refactor `cli/src/tools/renameFolder.ts` to use `zod` instead of `zod/v3`
- [ ] 1.2 Add `getTool()` function following the `isFolderExist` pattern
- [ ] 1.3 Add `renameFolderAgentTool(clientId: string)` function with user confirmation flow
- [ ] 1.4 Add `renameFolderMcpTool()` function that wraps `getTool()`
- [ ] 1.5 Move the complete implementation logic from MCP tool (path normalization, rename operation, metadata cache update)
- [ ] 1.6 Create backward-compatible `createRenameFolderTool` export

## 2. Update Tool Exports

- [ ] 2.1 Import `renameFolderAgentTool` and `renameFolderMcpTool` in `cli/src/tools/index.ts`
- [ ] 2.2 Add `renameFolder: renameFolderAgentTool` to the `agentTools` object
- [ ] 2.3 Add `renameFolder: renameFolderMcpTool` to the `mcpTools` object
- [ ] 2.4 Remove the old `createRenameFolderTool` export if fully replaced

## 3. Update MCP Wrapper

- [ ] 3.1 Update `cli/src/mcp/tools/renameFolderTool.ts` to use `mcpTools.renameFolder()` for tool definition
- [ ] 3.2 Keep the registration function `registerRenameFolderTool(server: McpServer): void`
- [ ] 3.3 Ensure the wrapper delegates to `mcpTools.renameFolder()` similar to `isFolderExistTool.ts`

## 4. Update MCP Server Registration

- [ ] 4.1 Verify `cli/src/mcp/mcp.ts` imports from correct location `./tools/renameFolderTool`
- [ ] 4.2 Verify the registration call uses the updated registration function

## 5. Update Chat Task

- [ ] 5.1 Update `cli/tasks/ChatTask.ts` to use `agentTools.renameFolder(clientId, abortSignal)`
- [ ] 5.2 Replace `createRenameFolderTool(clientId, abortSignal)` with agent tool
- [ ] 5.3 Remove import of `createRenameFolderTool` from ChatTask.ts

## 6. Cleanup and Verification

- [ ] 6.1 Remove the old implementation pattern from `cli/src/tools/renameFolder.ts` if fully replaced
- [ ] 6.2 Run TypeScript compiler to verify no type errors
- [ ] 6.3 Verify MCP server can register the tool correctly
- [ ] 6.4 Verify AI Agent can use the tool via `agentTools.renameFolder()`
- [ ] 6.5 Run existing unit tests to ensure no regressions
