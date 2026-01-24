# Design: UI Internationalization (i18n)

## Context

The Simple Media Manager UI is built with React 19 and uses modern patterns including Context API and Zustand for state management. The application has a comprehensive component library based on shadcn/ui and Radix UI. We need to add internationalization support that:
- Integrates seamlessly with existing architecture
- Provides type-safe translation keys
- Supports multiple languages with easy addition of new locales
- Optimizes bundle size through code splitting
- Works in both Electron desktop and standalone web modes

## Goals / Non-Goals

**Goals:**
- Implement complete i18n support in the UI module using i18next
- Support four languages: Chinese Simplified (zh-CN, default), Chinese Traditional Hong Kong (zh-HK), Chinese Traditional Taiwan (zh-TW), and English (en)
- Provide type-safe translation keys with TypeScript
- Enable runtime language switching without page reload
- Persist user's language preference in localStorage
- Organize translations by namespace for better maintainability
- Lazy load translation files to optimize initial bundle size
- Support pluralization and interpolation
- Format dates, times, and numbers according to locale

**Non-Goals:**
- Backend/CLI module internationalization (separate change)
- Automatic translation (manual translation required)
- RTL (right-to-left) layout support in initial version (future enhancement)
- Currency formatting (not applicable to media manager)
- Server-side rendering i18n (currently client-only)

## Decisions

### Decision 1: Use i18next ecosystem
**Rationale:**
- Industry standard for React i18n with 50k+ GitHub stars
- Excellent TypeScript support with typed resources
- Rich plugin ecosystem (language detection, HTTP backend)
- Built-in support for namespaces, pluralization, interpolation
- Well-documented and actively maintained
- Works seamlessly with React hooks pattern

**Alternatives considered:**
- `react-intl` (FormatJS): More complex API, less flexible
- `lingui`: Requires build-time compilation, less ecosystem support
- `polyglot.js`: Minimal features, no React integration

### Decision 2: Translation file organization
**Structure:**
```
ui/public/locales/
├── zh-CN/                     # Chinese Simplified (default)
│   ├── common.json           # Shared terms (Save, Cancel, Delete, etc.)
│   ├── components.json       # Component-specific strings
│   ├── dialogs.json          # Dialog titles and messages
│   ├── settings.json         # Settings panel strings
│   ├── errors.json           # Error messages
│   └── validation.json       # Form validation messages
├── zh-HK/                     # Chinese Traditional (Hong Kong)
│   └── [same structure]
├── zh-TW/                     # Chinese Traditional (Taiwan)
│   └── [same structure]
└── en/                        # English
    └── [same structure]
```

**Rationale:**
- Namespace separation improves maintainability
- Public folder allows dynamic loading without bundler config
- Lazy loading namespaces reduces initial bundle size
- Clear organization makes translator contributions easier

### Decision 3: Language detection strategy
**Priority:**
1. User's explicit language selection (from localStorage)
2. Browser language setting (navigator.language) mapped to supported locales
3. Fallback to Chinese Simplified (zh-CN)

**Rationale:**
- Respects user preference when set
- Provides good defaults based on browser with locale mapping (e.g., zh-HK → zh-HK, zh-TW → zh-TW, zh → zh-CN)
- Always has Chinese Simplified fallback for missing translations (primary target audience)

### Decision 4: TypeScript integration
Use `i18next` TypeScript support with resource type generation:
```typescript
// ui/src/types/i18next.d.ts
import 'i18next'
import type common from '../public/locales/en/common.json'
import type components from '../public/locales/en/components.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      components: typeof components
      // ... other namespaces
    }
  }
}
```

**Rationale:**
- Compile-time checking of translation keys
- Autocomplete in IDE for better DX
- Prevents typos in translation keys
- Self-documenting through types

### Decision 5: Language state management
Add language to existing config provider rather than creating separate provider:
```typescript
// ui/src/components/config-provider.tsx
interface ConfigContextType {
  // ... existing config
  language: string
  setLanguage: (lang: string) => void
}
```

**Rationale:**
- Reduces provider nesting
- Keeps configuration centralized
- Language is part of user preferences like theme
- Leverages existing localStorage persistence

### Decision 6: Initial languages
Support Chinese Simplified (zh-CN, default), Chinese Traditional Hong Kong (zh-HK), Chinese Traditional Taiwan (zh-TW), and English (en).

**Rationale:**
- Chinese Simplified as default reflects primary target audience
- Hong Kong and Taiwan variants support regional language preferences and terminology differences
- English provides accessibility for international users
- Four languages demonstrate robust i18n architecture
- Traditional Chinese variants can share most translations with region-specific adjustments

## Risks / Trade-offs

### Risk: Bundle size increase
**Mitigation:**
- Use namespace-based code splitting
- Load translations asynchronously
- Only load required language files
- Chinese Traditional variants share most content with Simplified (use OpenCC for conversion where appropriate)
- Estimated impact: ~80KB gzipped for four languages (Traditional Chinese variants share much content)

### Risk: Missing translations during transition
**Mitigation:**
- Implement fallback to English for missing keys
- Add development warning for untranslated strings
- Gradual migration component by component
- Default interpolation shows key name if missing

### Risk: Complex pluralization rules
**Mitigation:**
- i18next handles pluralization automatically
- Follow i18next conventions (key_one, key_other)
- Document pluralization examples for translators

### Risk: Date/time formatting complexity
**Mitigation:**
- Use Intl.DateTimeFormat API (browser native)
- Provide helper functions wrapping Intl APIs
- Document formatting patterns

### Trade-off: Manual translation required
**Acceptance:** Automatic translation quality is insufficient for UI text. Manual translation by native speakers ensures quality and cultural appropriateness.

## Migration Plan

### Phase 1: Infrastructure (Sprint 1)
1. Install dependencies
2. Configure i18next
3. Create translation file structure
4. Set up TypeScript types
5. Add language switcher UI

### Phase 2: Core Components (Sprint 2)
1. Extract strings from menu and navigation
2. Extract strings from dialogs
3. Extract strings from settings
4. Test English and Chinese switching

### Phase 3: Domain Components (Sprint 3)
1. Extract strings from media panels
2. Extract strings from file operations
3. Extract strings from search features
4. Complete Chinese translations

### Phase 4: Polish (Sprint 4)
1. Add date/time formatting
2. Handle edge cases
3. Performance optimization
4. Documentation

### Rollback Strategy
- Feature flag in config to enable/disable i18n
- If issues arise, default to English-only mode
- No data persistence changes (safe to rollback)

## Open Questions

1. **Q:** Should we support additional languages in the initial release?
   **A:** Initial release includes Chinese Simplified (default), Chinese Traditional (HK), Chinese Traditional (TW), and English. Community can contribute more languages after architecture is proven.

2. **Q:** How to handle differences between Hong Kong and Taiwan Traditional Chinese?
   **A:** Most UI text is identical. Use zh-HK as base Traditional Chinese, then override specific terms in zh-TW where terminology differs (e.g., "軟體" vs "軟体").

3. **Q:** How to handle AI-generated text that can't be pre-translated?
   **A:** AI responses remain in the language generated by the AI model. We can add language preference to AI prompts in future enhancement.

4. **Q:** Should backend API error messages be translated?
   **A:** Not in this change. Backend errors should use error codes, and UI can map codes to localized messages.

5. **Q:** How to handle mixed content (e.g., movie titles that shouldn't be translated)?
   **A:** Use interpolation: `t('movie.title', { title: movieName })` where template is translated but data is preserved.

## References

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [TypeScript Support](https://www.i18next.com/overview/typescript)
- [Best Practices](https://locize.com/blog/react-i18next/)

