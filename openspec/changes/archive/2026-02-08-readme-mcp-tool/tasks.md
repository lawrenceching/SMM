## 1. i18n Localization Setup

- [x] 1.1 Add English tool description to `cli/public/locales/en/tools.json`
- [x] 1.2 Add Chinese tool description to `cli/public/locales/zh-CN/tools.json`

## 2. Tool Implementation

- [x] 2.1 Create `cli/src/tools/readme.ts` with empty `readmeContent` constant
- [x] 2.2 Implement `getTool()` function returning `ToolDefinition` with:
  - Tool name: "readme"
  - Localized description using `getLocalizedToolDescription('readme')`
  - Empty input schema: `z.object({})`
  - Output schema with `text` field: `z.object({ text: z.string() })`
  - Execute function returning `createSuccessResponse({ text: readmeContent })`
- [x] 2.3 Export `readmeMcpTool()` function from `cli/src/tools/readme.ts`

## 3. MCP Wrapper

- [x] 3.1 Create `cli/src/mcp/tools/readmeTool.ts`
- [x] 3.2 Implement `registerReadmeTool(server: McpServer)` async function
- [x] 3.3 Register tool with MCP server using `server.registerTool()`

## 4. Integration

- [x] 4.1 Add import for `registerReadmeTool` to `cli/src/mcp/mcp.ts`
- [x] 4.2 Call `await registerReadmeTool(server)` in MCP server initialization
- [x] 4.3 Add import for `readmeMcpTool` to `cli/src/tools/index.ts`
- [x] 4.4 Add `readmeMcpTool` to exports in `cli/src/tools/index.ts`
- [x] 4.5 Add `readme: readmeMcpTool` to `mcpTools` object in `cli/src/tools/index.ts`

## 5. Testing

- [x] 5.1 Build the CLI module to verify no TypeScript errors
- [x] 5.2 Start MCP server and verify `readme` tool appears in tool list
- [x] 5.3 Call `readme` tool and verify it returns empty text content
- [x] 5.4 Verify tool description is properly localized for both English and Chinese
