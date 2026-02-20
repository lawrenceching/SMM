## Why

Users working with SMM through the MCP interface need guidance on how to recognize episode video files. Currently, the `how-to-rename-episode-video-files` tool provides instructions for file renaming, but there's no equivalent tool for the recognition workflow. Users need to understand the step-by-step process for recognizing video files with season/episode information before they can rename them.

## What Changes

- Add a new MCP tool `how-to-recognize-episode-video-files` that returns instructions for the episode video file recognition workflow
- Tool will provide structured markdown content explaining the recognition process
- Content will guide users through the three-step recognition task workflow (begin, add recognized files, end)
- Initially returns instructions in Chinese (can be extended to other languages later)

## Capabilities

### New Capabilities
- `how-to-recognize-episode-video-files`: MCP tool for retrieving instructions on how to recognize episode video files in SMM

### Modified Capabilities
- None (this is a pure addition)

## Impact

- **Code**:
  - New tool file: `cli/src/tools/howToRecognizeEpisodeVideoFiles.ts`
  - New MCP wrapper: `cli/src/mcp/tools/howToRecognizeEpisodeVideoFilesTool.ts`
  - Modified: `cli/src/mcp/mcp.ts` (add registration)
- **API**: New MCP tool `how-to-recognize-episode-video-files` with no input parameters, returns markdown text
- **Dependencies**: None (uses existing infrastructure)
- **i18n**: Tool description should be localized following existing patterns
