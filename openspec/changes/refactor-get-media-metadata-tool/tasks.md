## 1. Refactor Base Tool Implementation

- [ ] 1.1 Refactor `cli/src/tools/getMediaMetadata.ts` to use `zod` instead of `zod/v3`
- [ ] 1.2 Add `getTool(abortSignal?: AbortSignal)` function following the `listFiles` pattern
- [ ] 1.3 Add `getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal)` function
- [ ] 1.4 Add `getMediaMetadataMcpTool()` function that wraps `getTool()`
- [ ] 1.5 Move the complete implementation logic from MCP tool (folder validation, metadata lookup, file listing)
- [ ] 1.6 Create backward-compatible `getMediaMetadataTool` export

## 2. Update Tool Exports

- [ ] 2.1 Import `getMediaMetadataAgentTool` and `getMediaMetadataMcpTool` in `cli/src/tools/index.ts`
- [ ] 2.2 Add `getMediaMetadata: getMediaMetadataAgentTool` to the `agentTools` object
- [ ] 2.3 Add `getMediaMetadata: getMediaMetadataMcpTool` to the `mcpTools` object
- [ ] 2.4 Remove the old `createGetMediaMetadataTool` export if fully replaced

## 3. Update MCP Wrapper

- [ ] 3.1 Update `cli/src/mcp/tools/getMediaMetadataTool.ts` to use `mcpTools.getMediaMetadata()` for tool definition
- [ ] 3.2 Keep the registration function `registerGetMediaMetadataTool(server: McpServer): void`
- [ ] 3.3 Ensure the wrapper delegates to `mcpTools.getMediaMetadata()` similar to `listFilesTool.ts`

## 4. Update MCP Server Registration

- [ ] 4.1 Verify `cli/src/mcp/mcp.ts` imports from correct location `./tools/getMediaMetadataTool`
- [ ] 4.2 Verify the registration call uses the updated registration function

## 5. Update Chat Task

- [ ] 5.1 Update `cli/tasks/ChatTask.ts` to use `agentTools.getMediaMetadata(clientId, abortSignal)`
- [ ] 5.2 Replace `createGetMediaMetadataTool(clientId, abortSignal)` with agent tool
- [ ] 5.3 Remove import of `createGetMediaMetadataTool` from ChatTask.ts

## 6. Cleanup and Verification

- [ ] 6.1 Remove the old incomplete implementation pattern from `cli/src/tools/getMediaMetadata.ts` if fully replaced
- [ ] 6.2 Run TypeScript compiler to verify no type errors
- [ ] 6.3 Verify MCP server can register the tool correctly
- [ ] 6.4 Verify AI Agent can use the tool via `agentTools.getMediaMetadata()`
- [ ] 6.5 Run existing unit tests to ensure no regressions
