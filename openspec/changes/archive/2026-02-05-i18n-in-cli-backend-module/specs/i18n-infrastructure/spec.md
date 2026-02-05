## ADDED Requirements

### Requirement: i18next initialization
The system SHALL initialize i18next with i18next-fs-backend during server startup in the CLI backend module.

#### Scenario: Successful i18next initialization
- **WHEN** the CLI server starts
- **THEN** i18next is configured with:
  - Filesystem backend pointing to `cli/public/locales/`
  - Default language set to 'en'
  - Fallback language set to 'en'
  - Synchronous loading enabled
  - Debug mode disabled in production

#### Scenario: Translation directory structure exists
- **WHEN** i18next is initialized
- **THEN** the following directory structure MUST exist:
  - `cli/public/locales/en/tools.json`
  - `cli/public/locales/zh-CN/tools.json`
  - Additional locale directories for future languages

### Requirement: Translation file loading
The system SHALL load translation files from the filesystem using i18next-fs-backend.

#### Scenario: Load English translations
- **WHEN** i18next initializes with language 'en'
- **THEN** the system loads `cli/public/locales/en/tools.json`
- **AND** translations are available via `t()` function

#### Scenario: Load Chinese translations
- **WHEN** i18next initializes with language 'zh-CN'
- **THEN** the system loads `cli/public/locales/zh-CN/tools.json`
- **AND** translations are available via `t()` function

#### Scenario: Fallback to English for missing translations
- **WHEN** a translation key is requested in 'zh-CN' but the key doesn't exist
- **THEN** the system falls back to the 'en' translation
- **AND** no error is thrown

### Requirement: Translation file format
Translation files SHALL follow i18next JSON format with namespace organization.

#### Scenario: Valid tools.json structure
- **WHEN** a tools.json file is read
- **THEN** the file contains a JSON object with tool names as keys
- **AND** each tool name maps to an object with translation keys
- **AND** the structure is:
  ```json
  {
    "tool-name": {
      "description": "Tool description text"
    }
  }
  ```

#### Scenario: English tools.json exists
- **WHEN** `cli/public/locales/en/tools.json` is read
- **THEN** it contains at minimum:
  - `"get-app-context"` key with `"description"` field
  - Description text in English

#### Scenario: Chinese tools.json exists
- **WHEN** `cli/public/locales/zh-CN/tools.json` is read
- **THEN** it contains at minimum:
  - `"get-app-context"` key with `"description"` field
  - Description text in Simplified Chinese

### Requirement: Language detection integration
The system SHALL integrate with existing user configuration for language detection.

#### Scenario: Get language from user config
- **WHEN** language preference is needed
- **THEN** the system calls `getUserConfig()` from `@/utils/config`
- **AND** retrieves `applicationLanguage` property
- **AND** defaults to 'zh-CN' if not set
- **AND** returns the language code

#### Scenario: Invalid language code handling
- **WHEN** `getUserConfig()` returns an invalid or unsupported language code
- **THEN** the system treats it as 'zh-CN' (the existing default behavior)
- **AND** i18next falls back to 'en' for missing translations

#### Scenario: Config retrieval failure handling
- **WHEN** `getUserConfig()` throws an error or fails to load
- **THEN** the system logs a warning
- **AND** falls back to 'en' as the default language
- **AND** tool descriptions continue to work

### Requirement: Helper functions
The system SHALL provide helper functions for i18n operations in `cli/src/i18n/helpers.ts`.

#### Scenario: getLocalizedToolDescription function exists
- **WHEN** a tool needs a localized description
- **THEN** the `getLocalizedToolDescription(toolName: string)` function is available
- **AND** it returns a localized description string
- **AND** it accepts the tool name as a parameter
- **AND** it uses the language preference from global user config

#### Scenario: getToolLanguage function exists
- **WHEN** language preference is needed for a tool
- **THEN** the `getToolLanguage()` function is available
- **AND** it returns a language code string
- **AND** it retrieves user's language preference from global user config
- **AND** it defaults to 'zh-CN' if not set in config

### Requirement: Bun compatibility
The i18n infrastructure SHALL be compatible with Bun runtime.

#### Scenario: i18next works with Bun
- **WHEN** the CLI server runs on Bun
- **THEN** i18next and i18next-fs-backend work without Node.js-specific dependencies
- **AND** filesystem operations use Bun's fs module
- **AND** no polyfills are required

#### Scenario: Module imports work
- **WHEN** i18next is imported in TypeScript files
- **THEN** the imports use ES module syntax
- **AND** TypeScript types are available
- **AND** no CommonJS compatibility issues occur
