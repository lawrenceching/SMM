## Why

Users working with SMM through the MCP interface need easy access to documentation and usage guidelines without leaving their AI assistant context. Currently, the `how-to-rename-episode-video-files` tool provides specialized documentation for file renaming, but there's no general-purpose tool for accessing SMM's README and overall documentation.

## What Changes

- Add a new MCP tool `readme` that returns SMM's README documentation
- Tool will provide structured markdown content about SMM's capabilities, architecture, and usage
- Initially returns empty text (placeholder for future content)

## Capabilities

### New Capabilities
- `readme-mcp-tool`: MCP tool for retrieving SMM README and general documentation

### Modified Capabilities
- None (this is a pure addition)

## Impact

- **Code**:
  - New tool file: `cli/src/tools/readme.ts`
  - New MCP wrapper: `cli/src/mcp/tools/readmeTool.ts`
  - Modified: `cli/src/mcp/mcp.ts` (add registration)
- **API**: New MCP tool `readme` with no input parameters, returns markdown text
- **Dependencies**: None (uses existing infrastructure)
- **i18n**: May need translation entries if tool description should be localized
