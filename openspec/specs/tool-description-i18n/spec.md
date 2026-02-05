# tool-description-i18n Specification

## Purpose
TBD - created by archiving change i18n-in-cli-backend-module. Update Purpose after archive.
## Requirements
### Requirement: Tool description localization
MCP tools SHALL support localized descriptions based on user language preference.

#### Scenario: Tool returns English description
- **WHEN** a tool's description is requested and user's language is 'en'
- **THEN** the tool description is returned in English
- **AND** the description matches the content in `cli/public/locales/en/tools.json`

#### Scenario: Tool returns Chinese description
- **WHEN** a tool's description is requested and user's language is 'zh-CN'
- **THEN** the tool description is returned in Simplified Chinese
- **AND** the description matches the content in `cli/public/locales/zh-CN/tools.json`

#### Scenario: Tool falls back to English for unsupported language
- **WHEN** a tool's description is requested and user's language is 'fr' (unsupported)
- **THEN** the tool description falls back to English
- **AND** no error is thrown

### Requirement: getApplicationContext tool i18n integration
The getApplicationContext tool SHALL use localized descriptions based on global user configuration.

#### Scenario: getApplicationContext with English language
- **WHEN** `getApplicationContextMcpTool()` is called and user language is 'en'
- **THEN** the tool description is:
  ```
  Get SMM context:
    * The media folder user selected/focused on SMM UI
    * The language in user preferences
  ```
- **AND** the description is in English

#### Scenario: getApplicationContext with Chinese language
- **WHEN** `getApplicationContextMcpTool()` is called and user language is 'zh-CN'
- **THEN** the tool description is the Chinese translation of:
  ```
  Get SMM context:
    * The media folder user selected/focused on SMM UI
    * The language in user preferences
  ```
- **AND** the description is in Simplified Chinese

#### Scenario: getApplicationContext uses global user config
- **WHEN** `getApplicationContextMcpTool()` is called
- **THEN** the tool description uses the global user's language preference
- **AND** user config is read to determine the language

### Requirement: Tool definition structure
Tools using i18n SHALL maintain the same ToolDefinition interface.

#### Scenario: Tool definition type compatibility
- **WHEN** a tool uses `getLocalizedToolDescription()`
- **THEN** the tool definition still implements `ToolDefinition` interface
- **AND** the `description` field is a string
- **AND** the `toolName`, `inputSchema`, `outputSchema`, and `execute` fields are unchanged

#### Scenario: Tool registration works
- **WHEN** tools with localized descriptions are registered with MCP
- **THEN** tool registration succeeds without errors
- **AND** the tool is available to AI agents
- **AND** the description is properly localized

### Requirement: Translation key naming convention
Tool translation keys SHALL follow the tool name pattern.

#### Scenario: Key matches tool name
- **WHEN** a tool is named 'get-app-context'
- **THEN** the translation key in tools.json is 'get-app-context'
- **AND** the description is accessed via 'get-app-context.description'

#### Scenario: Key uses kebab-case
- **WHEN** a tool name contains multiple words
- **THEN** the translation key uses kebab-case (lowercase with hyphens)
- **AND** no spaces or underscores are used

### Requirement: Dynamic language switching
Tools SHALL support dynamic language switching based on global user configuration.

#### Scenario: Language change takes effect on next tool request
- **WHEN** user changes language preference in config
- **THEN** subsequent tool description requests use the new language
- **AND** language is re-read from user config on each request
- **AND** no server restart is required

### Requirement: Translation completeness
All translations for a tool SHALL provide the same set of keys.

#### Scenario: English and Chinese have matching keys
- **WHEN** `en/tools.json` contains a tool description
- **THEN** `zh-CN/tools.json` contains the same tool key
- **AND** both provide the 'description' field
- **AND** no keys are missing in either language

#### Scenario: Missing key falls back gracefully
- **WHEN** a tool key exists in 'en' but not 'zh-CN'
- **THEN** requesting the description in 'zh-CN' falls back to English
- **AND** the system logs a warning (optional, for debugging)
- **AND** the tool continues to function

### Requirement: Error handling
i18n system SHALL handle errors gracefully without breaking tool functionality.

#### Scenario: Translation file missing
- **WHEN** a translation file (e.g., `zh-CN/tools.json`) doesn't exist
- **THEN** the system falls back to English translations
- **AND** tools continue to work with English descriptions
- **AND** no error is thrown to the caller

#### Scenario: Invalid JSON in translation file
- **WHEN** a translation file contains invalid JSON
- **THEN** the system logs an error
- **AND** falls back to English or previous working language
- **AND** tool registration continues without crashing

#### Scenario: i18n initialization failure
- **WHEN** i18next fails to initialize
- **THEN** the system logs the error
- **AND** tools fall back to hard-coded descriptions
- **AND** the server continues running

