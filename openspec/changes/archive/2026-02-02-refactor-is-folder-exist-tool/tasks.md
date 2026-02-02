## 1. Refactor Base Tool Implementation

- [x] 1.1 Refactor `cli/src/tools/isFolderExist.ts` to use `zod` instead of `zod/v3`
- [x] 1.2 Add `getTool()` function following the `getApplicationContext` pattern
- [x] 1.3 Add `isFolderExistAgentTool()` function that wraps `getTool()` with clientId support
- [x] 1.4 Add `isFolderExistMcpTool()` function that wraps `getTool()` without clientId
- [x] 1.5 Move the complete implementation logic from MCP tool (path normalization, stat check, error handling)

## 2. Update Tool Exports

- [x] 2.1 Import `isFolderExistAgentTool` and `isFolderExistMcpTool` in `cli/src/tools/index.ts`
- [x] 2.2 Add `isFolderExist: isFolderExistAgentTool` to the `agentTools` object
- [x] 2.3 Add `isFolderExist: isFolderExistMcpTool` to the `mcpTools` object
- [x] 2.4 Remove the direct `isFolderExistTool` export if it exists separately

## 3. Update MCP Wrapper

- [x] 3.1 Update `cli/src/mcp/tools/isFolderExistTool.ts` to use `mcpTools.isFolderExist()` for tool definition
- [x] 3.2 Keep the registration function `registerIsFolderExistTool(server: McpServer): void`
- [x] 3.3 Ensure the wrapper delegates to `mcpTools.isFolderExist()` similar to `getApplicationContextTool.ts`

## 4. Update MCP Server Registration

- [x] 4.1 Verify `cli/src/mcp/mcp.ts` imports from correct location `./tools/isFolderExistTool`
- [x] 4.2 Verify the registration call uses the updated registration function

## 5. Update Chat Task

- [x] 5.1 Update `cli/tasks/ChatTask.ts` to use `agentTools.isFolderExist(clientId)`
- [x] 5.2 Replace the inline `{ ...isFolderExistTool, execute: ... }` pattern with agent tool
- [x] 5.3 Ensure abortSignal is passed correctly to the agent tool

## 6. Cleanup and Verification

- [x] 6.1 Remove the old incomplete implementation from `cli/src/tools/isFolderExist.ts` if fully replaced
- [x] 6.2 Run TypeScript compiler to verify no type errors
- [x] 6.3 Verify MCP server can register the tool correctly
- [x] 6.4 Verify AI Agent can use the tool via `agentTools.isFolderExist()`
