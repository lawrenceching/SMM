# ui-i18n Specification

## Purpose
TBD - created by archiving change add-ui-i18n. Update Purpose after archive.
## Requirements
### Requirement: Language Selection
The UI MUST allow users to select their preferred language from available options.

#### Scenario: User changes language from settings
- **WHEN** user opens settings dialog
- **AND** navigates to language selector
- **AND** selects a different language
- **THEN** the UI immediately updates to display text in the selected language
- **AND** the language preference is persisted in localStorage

#### Scenario: User changes language from mobile menu
- **WHEN** user opens mobile navigation menu
- **AND** taps the language switcher
- **AND** selects a different language
- **THEN** the UI updates to the selected language without page reload

### Requirement: Language Detection
The system MUST automatically detect and apply an appropriate language on first launch.

#### Scenario: First-time user with supported browser language
- **WHEN** user launches the application for the first time
- **AND** browser language is set to a supported language (e.g., zh-CN)
- **THEN** the UI displays in the detected language

#### Scenario: First-time user with unsupported browser language
- **WHEN** user launches the application for the first time
- **AND** browser language is not supported (e.g., fr-FR)
- **THEN** the UI defaults to Chinese Simplified

#### Scenario: Returning user with saved preference
- **WHEN** user launches the application
- **AND** has previously selected a language preference
- **THEN** the UI displays in the saved language regardless of browser settings

### Requirement: Language Persistence
The system MUST persist the user's language preference across sessions.

#### Scenario: Language persists after browser close
- **WHEN** user selects Chinese as preferred language
- **AND** closes and reopens the browser
- **THEN** the UI continues to display in Chinese

#### Scenario: Language persists in Electron app
- **WHEN** user selects a language in Electron desktop app
- **AND** closes and reopens the application
- **THEN** the UI displays in the previously selected language

### Requirement: Translation Coverage
All user-facing text in the UI MUST be translatable.

#### Scenario: Menu items are translated
- **WHEN** user switches to Chinese language
- **THEN** all menu items (File, Edit, View, Help) display in Chinese

#### Scenario: Dialog titles and buttons are translated
- **WHEN** user opens any dialog in Chinese mode
- **THEN** dialog title, content, and action buttons display in Chinese

#### Scenario: Error messages are translated
- **WHEN** an error occurs while in Chinese mode
- **THEN** error messages and toasts display in Chinese

#### Scenario: Settings panel is translated
- **WHEN** user opens settings in Chinese mode
- **THEN** all settings labels, descriptions, and options display in Chinese

### Requirement: Translation Namespace Organization
Translations MUST be organized into logical namespaces for maintainability.

#### Scenario: Common translations are reusable
- **WHEN** multiple components need the same text (e.g., "Save", "Cancel")
- **THEN** they use the common namespace
- **AND** translation appears consistently across all components

#### Scenario: Component-specific translations are isolated
- **WHEN** component has unique terminology
- **THEN** translations are in component-specific namespace
- **AND** changes don't affect other components

### Requirement: Type Safety for Translation Keys
The system MUST provide TypeScript type checking for translation keys.

#### Scenario: Valid translation key compiles
- **WHEN** developer uses `t('common.save')`
- **AND** the key exists in translation files
- **THEN** TypeScript compiler succeeds

#### Scenario: Invalid translation key fails compilation
- **WHEN** developer uses `t('common.nonexistent')`
- **AND** the key does not exist in translation files
- **THEN** TypeScript compiler reports an error

#### Scenario: Autocomplete suggests valid keys
- **WHEN** developer types `t('common.`
- **THEN** IDE shows autocomplete suggestions for all common namespace keys

### Requirement: Fallback Handling
The system MUST gracefully handle missing translations.

#### Scenario: Missing translation shows fallback
- **WHEN** a translation key exists in Chinese Simplified but not in Traditional Chinese
- **THEN** the Chinese Simplified text is displayed
- **AND** a warning is logged in development mode

#### Scenario: Missing key shows key name
- **WHEN** a translation key doesn't exist in any language
- **THEN** the key name is displayed
- **AND** an error is logged in development mode

### Requirement: Interpolation Support
The system MUST support dynamic value interpolation in translations.

#### Scenario: Simple interpolation
- **WHEN** translation is `"Hello, {{name}}"`
- **AND** called with `t('greeting', { name: 'John' })`
- **THEN** displays "Hello, John"

#### Scenario: Multiple interpolations
- **WHEN** translation is `"Found {{count}} items in {{folder}}"`
- **AND** called with `t('search.result', { count: 5, folder: 'Movies' })`
- **THEN** displays "Found 5 items in Movies"

### Requirement: Pluralization Support
The system MUST support pluralization rules for different languages.

#### Scenario: English pluralization
- **WHEN** translation keys are `"file_one": "{{count}} file"` and `"file_other": "{{count}} files"`
- **AND** called with `t('file', { count: 1 })`
- **THEN** displays "1 file"
- **WHEN** called with `t('file', { count: 5 })`
- **THEN** displays "5 files"

#### Scenario: Chinese pluralization
- **WHEN** Chinese doesn't have plural forms
- **AND** translation is `"file": "{{count}} 个文件"`
- **THEN** displays "1 个文件" or "5 个文件" using the same form

### Requirement: Date and Time Formatting
The system MUST format dates and times according to the selected locale.

#### Scenario: Date formatting in English
- **WHEN** language is English
- **AND** date is 2026-01-06
- **THEN** displays as "January 6, 2026" or "1/6/2026" based on format

#### Scenario: Date formatting in Chinese
- **WHEN** language is Chinese
- **AND** date is 2026-01-06
- **THEN** displays as "2026年1月6日"

#### Scenario: Relative time formatting
- **WHEN** timestamp is 2 hours ago
- **THEN** displays "2 hours ago" in English or "2小时前" in Chinese

### Requirement: Number Formatting
The system MUST format numbers according to the selected locale.

#### Scenario: Large number formatting in English
- **WHEN** language is English
- **AND** number is 1234567
- **THEN** displays as "1,234,567"

#### Scenario: Large number formatting in Chinese
- **WHEN** language is Chinese
- **AND** number is 1234567
- **THEN** displays as "1,234,567" (same convention)

### Requirement: Lazy Loading of Translations
The system MUST load translation files on-demand to optimize bundle size.

#### Scenario: Initial load includes only active language
- **WHEN** application starts with Chinese Simplified language
- **THEN** only Chinese Simplified translation files are loaded
- **AND** other language translation files are not loaded

#### Scenario: Language switch loads new files
- **WHEN** user switches from Chinese Simplified to English
- **THEN** English translation files are fetched
- **AND** UI updates after files are loaded

#### Scenario: Namespace lazy loading
- **WHEN** user navigates to settings dialog
- **THEN** settings namespace is loaded if not already cached
- **AND** UI displays with loaded translations

### Requirement: Supported Languages
The system MUST support Chinese Simplified (default), Chinese Traditional (Hong Kong), Chinese Traditional (Taiwan), and English.

#### Scenario: Chinese Simplified is default
- **WHEN** user launches the application for the first time
- **AND** no language preference is saved
- **AND** browser language is not one of the supported languages
- **THEN** the UI displays in Chinese Simplified

#### Scenario: Chinese Simplified available
- **WHEN** user opens language selector
- **THEN** "简体中文" (Simplified Chinese) is listed as an option
- **AND** can be selected

#### Scenario: Chinese Traditional Hong Kong available
- **WHEN** user opens language selector
- **THEN** "繁體中文（香港）" (Traditional Chinese Hong Kong) is listed as an option
- **AND** can be selected

#### Scenario: Chinese Traditional Taiwan available
- **WHEN** user opens language selector
- **THEN** "繁體中文（台灣）" (Traditional Chinese Taiwan) is listed as an option
- **AND** can be selected

#### Scenario: English language available
- **WHEN** user opens language selector
- **THEN** "English" is listed as an option
- **AND** can be selected

#### Scenario: Browser language detection for Hong Kong
- **WHEN** user launches application for the first time
- **AND** browser language is set to "zh-HK"
- **THEN** the UI displays in Traditional Chinese (Hong Kong)

#### Scenario: Browser language detection for Taiwan
- **WHEN** user launches application for the first time
- **AND** browser language is set to "zh-TW"
- **THEN** the UI displays in Traditional Chinese (Taiwan)

### Requirement: Language Switcher UI
The UI MUST provide an accessible language switcher component.

#### Scenario: Language switcher in desktop settings
- **WHEN** user opens settings dialog on desktop
- **THEN** language selector is visible in general settings
- **AND** shows current language
- **AND** displays list of available languages on click

#### Scenario: Language switcher shows language names in native script
- **WHEN** user opens language selector
- **THEN** Chinese Simplified is shown as "简体中文"
- **AND** Chinese Traditional (HK) is shown as "繁體中文（香港）"
- **AND** Chinese Traditional (TW) is shown as "繁體中文（台灣）"
- **AND** English is shown as "English"
- **AND** each language name is in its native script

#### Scenario: Current language is indicated
- **WHEN** language selector is opened
- **THEN** currently active language has a checkmark or highlight
- **AND** is visually distinguishable from other options

### Requirement: Developer Experience
The system MUST provide clear guidelines and tools for developers adding translations.

#### Scenario: Translation helper hook is available
- **WHEN** developer imports `useTranslation` hook
- **THEN** TypeScript provides type hints for available namespaces
- **AND** autocomplete works for translation keys

#### Scenario: Development warnings for missing translations
- **WHEN** application runs in development mode
- **AND** a translation key is missing
- **THEN** a warning appears in browser console
- **AND** includes the missing key and namespace

### Requirement: Translation File Format
Translation files MUST use JSON format with nested structure for organization.

#### Scenario: JSON structure is valid
- **WHEN** translation file is loaded
- **THEN** it is valid JSON
- **AND** can be parsed without errors

#### Scenario: Nested keys for organization
- **WHEN** translation file contains related strings
- **THEN** they are organized under nested objects
- **EXAMPLE:** `{ "dialog": { "confirm": { "title": "Confirm", "message": "Are you sure?" } } }`

#### Scenario: Flat keys for simple cases
- **WHEN** namespace has few unrelated strings
- **THEN** flat structure is acceptable
- **EXAMPLE:** `{ "save": "Save", "cancel": "Cancel", "delete": "Delete" }`

