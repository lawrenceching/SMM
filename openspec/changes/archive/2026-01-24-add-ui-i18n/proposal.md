# Change: Add Internationalization (i18n) Support to UI Module

## Why

The application currently only supports English language. To make the Simple Media Manager accessible to a global audience, we need to implement internationalization (i18n) support in the UI module. This will allow users to use the application in their preferred language, improving user experience and expanding the potential user base.

## What Changes

- Add `i18next` and `react-i18next` libraries to the UI module
- Create translation infrastructure with namespace organization
- Implement language detection and persistence
- Add language switcher UI component
- Extract all hardcoded English text to translation keys
- Provide initial support for four languages: Chinese Simplified (default), Chinese Traditional (Hong Kong), Chinese Traditional (Taiwan), and English
- Configure translation file structure following best practices
- Integrate with existing theme and config providers

## Impact

- **Affected specs**: New capability `ui-i18n`
- **Affected code**:
  - `ui/package.json` - Add i18next dependencies
  - `ui/src/main.tsx` - Initialize i18n
  - `ui/src/lib/i18n.ts` - New i18n configuration file
  - `ui/public/locales/` - New translation files directory
  - `ui/src/components/` - Extract strings from all components
  - `ui/src/components/mode-toggle.tsx` - Add language switcher
  - `ui/src/components/config-provider.tsx` - Add language state management
  - `ui/src/types/` - Add i18n types
- **User experience**: Users can select their preferred language from settings
- **Developer experience**: Developers must use translation keys for all user-facing strings
- **Non-breaking**: Existing functionality remains unchanged, defaults to Chinese Simplified

