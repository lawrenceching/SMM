## 1. Refactor Base Tool Implementation

- [ ] 1.1 Add `getTool()` function to `cli/src/tools/getMediaFolders.ts` following the `getApplicationContext` pattern
- [ ] 1.2 Add `getMediaFoldersAgentTool()` function that wraps `getTool()` with clientId support
- [ ] 1.3 Add `getMediaFoldersMcpTool()` function that wraps `getTool()` without clientId

## 2. Update Tool Exports

- [ ] 2.1 Import `getMediaFoldersAgentTool` and `getMediaFoldersMcpTool` in `cli/src/tools/index.ts`
- [ ] 2.2 Add `getMediaFolders: getMediaFoldersAgentTool` to the `agentTools` object
- [ ] 2.3 Add `getMediaFolders: getMediaFoldersMcpTool` to the `mcpTools` object
- [ ] 2.4 Remove the direct `getMediaFoldersTool` export if it exists separately

## 3. Create MCP Wrapper

- [ ] 3.1 Create `cli/src/mcp/tools/getMediaFoldersTool.ts` directory if needed
- [ ] 3.2 Create registration function `registerGetMediaFoldersTool(server: McpServer): void`
- [ ] 3.3 The registration function SHALL use `mcpTools.getMediaFolders()` to get the tool definition
- [ ] 3.4 Verify the registration follows the pattern from `getApplicationContextTool.ts`

## 4. Update MCP Server Registration

- [ ] 4.1 Update `cli/src/mcp/mcp.ts` import to use new location `./tools/getMediaFoldersTool`
- [ ] 4.2 Update the registration call to use the new registration function
- [ ] 4.3 Remove the old import of `registerGetMediaFoldersTool` from the old location

## 5. Update Chat Task

- [ ] 5.1 Update `cli/tasks/ChatTask.ts` to import `agentTools` from `../src/tools`
- [ ] 5.2 Replace direct `getMediaFoldersTool` usage with `agentTools.getMediaFolders(clientId)`
- [ ] 5.3 Ensure abortSignal is passed correctly to the agent tool

## 6. Cleanup and Verification

- [ ] 6.1 Remove old `cli/src/mcp/getMediaFoldersTool.ts` file
- [ ] 6.2 Run TypeScript compiler to verify no type errors
- [ ] 6.3 Verify MCP server can register the tool correctly
- [ ] 6.4 Verify AI Agent can use the tool via `agentTools.getMediaFolders()`
