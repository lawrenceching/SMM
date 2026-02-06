## Context

The `getApplicationContext` tool has been successfully internationalized using the i18next infrastructure. The pattern is established and proven. This change applies the same pattern to the remaining 5 MCP tools in the CLI backend module.

The existing i18n infrastructure (`i18n-infrastructure` and `tool-description-i18n` specs) already defines the requirements. This change is an implementation exercise, not a new capability.

## Goals / Non-Goals

**Goals:**
- Apply the established i18n pattern to all remaining MCP tools
- Maintain consistency with the getApplicationContext implementation
- Ensure all tools use the same global language configuration
- Complete the i18n coverage for CLI backend tools

**Non-Goals:**
- No new i18n infrastructure (reuse existing)
- No spec changes (existing requirements cover this)
- No per-client language support (continue using global config)
- No changes to tool functionality or behavior

## Decisions

### 1. Follow Established Pattern Exactly

**Choice**: Use the exact same pattern as getApplicationContext for all remaining tools.

**Rationale**:
- Consistency across the codebase
- Proven to work (getApplicationContext is complete)
- No need to invent new approaches
- Documentation already exists

**Pattern to Apply**:
1. Import `getLocalizedToolDescription` from `@/i18n/helpers`
2. Make `getTool()` function async
3. Call `getLocalizedToolDescription('tool-name')` for description
4. Make export functions async (`getToolAgentTool`, `getToolMcpTool`)
5. Update MCP registration function to be async

### 2. Update All Tools in Single Change

**Choice**: Update all 5 remaining tools in one change rather than incrementally.

**Rationale**:
- Same pattern applied to all tools
- Low risk (mechanical changes)
- Completes the feature in one iteration
- Reduces review overhead

**Tools to Update**:
- isFolderExist
- getMediaFolders
- listFiles
- getMediaMetadata
- renameFolder

### 3. Translation Key Naming

**Choice**: Use kebab-case tool names as translation keys.

**Rationale**:
- Matches existing getApplicationContext pattern
- i18next namespace organization
- Consistent with tool naming convention

**Examples**:
- `is-folder-exist` → `is-folder-exist.description`
- `get-media-folders` → `get-media-folders.description`
- `list-files` → `list-files.description`
- `get-media-metadata` → `get-media-metadata.description`
- `rename-folder` → `rename-folder.description`

### 4. MCP Server Registration

**Choice**: Update all registration calls to use `await`.

**Rationale**:
- Tool functions are now async
- Registration must wait for tool definitions
- Matches getApplicationContextMcpTool pattern
- Ensures descriptions are loaded before registration

## Risks / Trade-offs

### Risk: Mechanical Copy-Paste Errors

**Risk**: Applying the same pattern to 5 tools increases chance of copy-paste mistakes.

**Mitigation**:
- TypeScript will catch type errors
- Build process validates all changes
- Systematic approach: one tool at a time
- Reference getApplicationContext as template

### Risk: Translation Accuracy

**Risk**: Translating 5 tool descriptions accurately to Chinese.

**Mitigation**:
- Keep descriptions simple and direct
- Use consistent terminology
- User can review and adjust translations
- English fallback always available

### Trade-off: No Per-Client Language

**Trade-off**: All tools use global config, no per-client language support.

**Justification**:
- Consistent with getApplicationContext approach
- Simpler implementation
- Sufficient for current use case
- Can be enhanced later if needed

## Migration Plan

### Phase 1: Update Tool Files (5 files)
1. `isFolderExist.ts`: Add i18n, make async
2. `getMediaFolders.ts`: Add i18n, make async
3. `listFiles.ts`: Add i18n, make async
4. `getMediaMetadata.ts`: Add i18n, make async
5. `renameFolder.ts`: Add i18n, make async

### Phase 2: Update MCP Registration (5 files)
1. `isFolderExistTool.ts`: Make registration async
2. `getMediaFoldersTool.ts`: Make registration async
3. `listFilesTool.ts`: Make registration async
4. `getMediaMetadataTool.ts`: Make registration async
5. `renameFolderTool.ts`: Make registration async

### Phase 3: Update MCP Server
1. `cli/src/mcp/mcp.ts`: Add await for all 5 registrations
2. Verify order: await getApplicationContext, then await the rest

### Phase 4: Add Translations
1. Add English keys to `cli/public/locales/en/tools.json`
2. Add Chinese keys to `cli/public/locales/zh-CN/tools.json`
3. Verify JSON structure and completeness

### Phase 5: Validate
1. Build succeeds: `bun build ./index.ts --target bun`
2. All tools load correctly
3. Descriptions are localized
4. No type errors

### Rollback Strategy

If issues arise:
- Revert individual tool files (isolated changes)
- Revert mcp.ts (remove await statements)
- Translation files can stay (no harm)
- No database or state changes

All changes are isolated to tool description loading.
