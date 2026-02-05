## Why

The MCP tool descriptions in the CLI backend are currently hard-coded in English. As SMM expands to support international users, tool descriptions need to be localized to match the user's preferred language setting. This improves UX for non-English users by providing descriptions in their native language.

## What Changes

- **Setup i18next infrastructure** in CLI backend module:
  - Install and configure `i18next` and `i18next-fs-backend` for Bun runtime
  - Create locale files directory structure for translations
  - Initialize i18next instance with file system backend

- **Create translation files** for tool descriptions:
  - English (en) as default/source language
  - Simplified Chinese (zh-CN) as initial translated language
  - Structure: JSON files keyed by tool name and description field

- **Modify getApplicationContext tool** to use i18n:
  - Convert hard-coded description to use i18n translation key
  - Dynamically load description based on user's language preference
  - Keep existing `getLanguage()` function as language source

## Capabilities

### New Capabilities
- `i18n-infrastructure`: Core internationalization system for CLI backend, including i18next setup, translation file management, and language detection integration
- `tool-description-i18n`: System for localizing MCP tool descriptions, supporting dynamic description loading based on user preferences

### Modified Capabilities
- None (this is a new capability addition, not a behavior change to existing specs)

## Impact

**Affected Code**:
- `cli/src/tools/getApplicationContext.ts` - Convert tool description to use i18n
- New: `cli/src/i18n/` directory for i18n configuration
- New: `cli/public/locales/` directory for translation JSON files

**Dependencies**:
- Add: `i18next`, `i18next-fs-backend` to cli/package.json

**Systems**:
- MCP tool registration system will now return localized descriptions
- No changes to API endpoints or response structures
- No UI changes (this is backend-only)

**Future Extensibility**:
- Pattern established here can be applied to other tools in `cli/src/tools/`
- Can extend to error messages, validation messages, and other user-facing strings
