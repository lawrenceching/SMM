# Specifications for i18n-in-cli-module-for-rest-tools

## Overview

This change applies existing i18n specifications to additional MCP tools. No new requirements are introduced.

## Referenced Specifications

This change implements requirements from existing specifications:

### i18n-infrastructure
- **Location**: `openspec/specs/i18n-infrastructure/spec.md`
- **Requirements Applied**:
  - Helper functions: `getToolLanguage()` and `getLocalizedToolDescription()`
  - Translation file loading from filesystem
  - Global user config integration
  - Bun runtime compatibility

### tool-description-i18n
- **Location**: `openspec/specs/tool-description-i18n/spec.md`
- **Requirements Applied**:
  - Tool description localization based on global user config
  - Tool definition structure compatibility
  - Translation key naming conventions (kebab-case)
  - Dynamic language switching
  - Translation completeness (all languages have matching keys)

## Tools Being Updated

The following tools will implement the existing i18n requirements:

1. **isFolderExist** (`cli/src/tools/isFolderExist.ts`)
2. **getMediaFolders** (`cli/src/tools/getMediaFolders.ts`)
3. **listFiles** (`cli/src/tools/listFiles.ts`)
4. **getMediaMetadata** (`cli/src/tools/getMediaMetadata.ts`)
5. **renameFolder** (`cli/src/tools/renameFolder.ts`)

Each tool will follow the pattern established by `getApplicationContext`.

## No New Requirements

This change does NOT introduce new requirements. It applies existing i18n requirements to additional tools as an implementation exercise.

## Verification

To verify this change meets existing specifications:

1. Each tool uses `getLocalizedToolDescription(toolName: string)` from `@/i18n/helpers`
2. Each tool's description is returned based on global user config
3. Translation keys exist in both `en/tools.json` and `zh-CN/tools.json`
4. All tools maintain ToolDefinition interface compatibility
5. All tools support dynamic language switching via global config
