## 1. Refactor Base Tool Implementation

- [x] 1.1 Refactor `cli/src/tools/getMediaMetadata.ts` to use `zod` instead of `zod/v3`
- [x] 1.2 Add `getTool(abortSignal?: AbortSignal)` function following the `listFiles` pattern
- [x] 1.3 Add `getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal)` function
- [x] 1.4 Add `getMediaMetadataMcpTool()` function that wraps `getTool()`
- [x] 1.5 Move the complete implementation logic from MCP tool (folder validation, metadata lookup, file listing)
- [x] 1.6 Create backward-compatible `getMediaMetadataTool` export

## 2. Update Tool Exports

- [x] 2.1 Import `getMediaMetadataAgentTool` and `getMediaMetadataMcpTool` in `cli/src/tools/index.ts`
- [x] 2.2 Add `getMediaMetadata: getMediaMetadataAgentTool` to the `agentTools` object
- [x] 2.3 Add `getMediaMetadata: getMediaMetadataMcpTool` to the `mcpTools` object
- [x] 2.4 Remove the old `createGetMediaMetadataTool` export if fully replaced

## 3. Update MCP Wrapper

- [x] 3.1 Update `cli/src/mcp/tools/getMediaMetadataTool.ts` to use `mcpTools.getMediaMetadata()` for tool definition
- [x] 3.2 Keep the registration function `registerGetMediaMetadataTool(server: McpServer): void`
- [x] 3.3 Ensure the wrapper delegates to `mcpTools.getMediaMetadata()` similar to `listFilesTool.ts`

## 4. Update MCP Server Registration

- [x] 4.1 Verify `cli/src/mcp/mcp.ts` imports from correct location `./tools/getMediaMetadataTool`
- [x] 4.2 Verify the registration call uses the updated registration function

## 5. Update Chat Task

- [x] 5.1 Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaMetadata(clientId, abortSignal)`
- [x] 5.2 Replace `createGetMediaMetadataTool(clientId, abortSignal)` with agent tool
- [x] 5.3 Remove import of `createGetMediaMetadataTool` from ChatTask.ts

## 6. Cleanup and Verification

- [x] 6.1 Remove the old incomplete implementation pattern from `cli/src/tools/getMediaMetadata.ts` if fully replaced
- [x] 6.2 Run TypeScript compiler to verify no type errors
- [x] 6.3 Verify MCP server can register the tool correctly
- [x] 6.4 Verify AI Agent can use the tool via `agentTools.getMediaMetadata()`
- [x] 6.5 Run existing unit tests to ensure no regressions
