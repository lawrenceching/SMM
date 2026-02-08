## 1. i18n Localization Setup

- [x] 1.1 Add English tool description to `cli/public/locales/en/tools.json`
- [x] 1.2 Add Chinese tool description to `cli/public/locales/zh-CN/tools.json`

## 2. Tool Implementation

- [x] 2.1 Create `cli/src/tools/howToRecognizeEpisodeVideoFiles.ts` with static instruction content in Chinese
- [x] 2.2 Implement `getTool()` function returning `ToolDefinition` with:
  - Tool name: "how-to-recognize-episode-video-files"
  - Localized description using `getLocalizedToolDescription('how-to-recognize-episode-video-files')`
  - Empty input schema: `z.object({})`
  - Output schema with `text` field: `z.object({ text: z.string() })`
  - Execute function returning `createSuccessResponse({ text: instructions })`
- [x] 2.3 Write instruction content explaining three-step recognition workflow:
  - Step 1: Use `begin-recognize-task` to start recognition
  - Step 2: Use `add-recognized-media-file` to add recognized files with season/episode info
  - Step 3: Use `end-recognize-task` to complete and submit the recognition plan
  - Include practical example with sample season/episode numbers
- [x] 2.4 Export `howToRecognizeEpisodeVideoFilesMcpTool()` function from `cli/src/tools/howToRecognizeEpisodeVideoFiles.ts`

## 3. MCP Wrapper

- [x] 3.1 Create `cli/src/mcp/tools/howToRecognizeEpisodeVideoFilesTool.ts`
- [x] 3.2 Implement `registerHowToRecognizeEpisodeVideoFilesTool(server: McpServer)` async function
- [x] 3.3 Register tool with MCP server using `server.registerTool()`

## 4. Integration

- [x] 4.1 Add import for `registerHowToRecognizeEpisodeVideoFilesTool` to `cli/src/mcp/mcp.ts`
- [x] 4.2 Call `await registerHowToRecognizeEpisodeVideoFilesTool(server)` in MCP server initialization
- [x] 4.3 Add import for `howToRecognizeEpisodeVideoFilesMcpTool` to `cli/src/tools/index.ts`
- [x] 4.4 Add `howToRecognizeEpisodeVideoFilesMcpTool` to exports in `cli/src/tools/index.ts`
- [x] 4.5 Add `howToRecognizeEpisodeVideoFiles: howToRecognizeEpisodeVideoFilesMcpTool` to `mcpTools` object in `cli/src/tools/index.ts`

## 5. Testing

- [x] 5.1 Build the CLI module to verify no TypeScript errors
- [ ] 5.2 Start MCP server and verify `how-to-recognize-episode-video-files` tool appears in tool list
- [ ] 5.3 Call `how-to-recognize-episode-video-files` tool and verify it returns Chinese instruction content
- [ ] 5.4 Verify tool description is properly localized for both English and Chinese
- [ ] 5.5 Verify instruction content includes all three workflow steps and practical example
