## Why

The getApplicationContext tool has been successfully internationalized, but the remaining MCP tools in the CLI backend still use hard-coded English descriptions. To provide a consistent multilingual experience for all users, we need to extend i18n support to all other MCP tools following the same pattern.

## What Changes

- **Extend i18n to all remaining MCP tools** in `cli/src/tools/`:
  - `isFolderExist.ts`
  - `getMediaFolders.ts`
  - `listFiles.ts`
  - `getMediaMetadata.ts`
  - `renameFolder.ts`

- **Add translation keys** to existing translation files (`cli/public/locales/en/tools.json` and `cli/public/locales/zh-CN/tools.json`)

- **Update MCP registration functions** to be async (matching the getApplicationContext pattern)

- **Update MCP server initialization** to await all tool registrations

## Capabilities

### New Capabilities
None - reusing existing `i18n-infrastructure` and `tool-description-i18n` capabilities

### Modified Capabilities
None - the existing i18n specs already cover tool description localization. This change applies the existing pattern to additional tools without changing requirements.

## Impact

**Affected Code**:
- `cli/src/tools/isFolderExist.ts` - Convert to use getLocalizedToolDescription
- `cli/src/tools/getMediaFolders.ts` - Convert to use getLocalizedToolDescription
- `cli/src/tools/listFiles.ts` - Convert to use getLocalizedToolDescription
- `cli/src/tools/getMediaMetadata.ts` - Convert to use getLocalizedToolDescription
- `cli/src/tools/renameFolder.ts` - Convert to use getLocalizedToolDescription
- `cli/src/mcp/tools/isFolderExistTool.ts` - Make registration async
- `cli/src/mcp/tools/getMediaFoldersTool.ts` - Make registration async
- `cli/src/mcp/tools/listFilesTool.ts` - Make registration async
- `cli/src/mcp/tools/getMediaMetadataTool.ts` - Make registration async
- `cli/src/mcp/tools/renameFolderTool.ts` - Make registration async
- `cli/src/mcp/mcp.ts` - Add await for all tool registrations
- `cli/public/locales/en/tools.json` - Add English descriptions for 5 tools
- `cli/public/locales/zh-CN/tools.json` - Add Chinese descriptions for 5 tools

**Dependencies**:
- No new dependencies (using existing i18next and i18next-fs-backend)

**Systems**:
- All MCP tools will return localized descriptions based on global user config
- No breaking changes to tool functionality or API contracts
- Consistent user experience across all tools
