## Context

The CLI backend module serves the MCP tools that are used by AI agents. Currently, all tool descriptions are hard-coded in English strings within the tool definition files (e.g., `cli/src/tools/getApplicationContext.ts`). The system already has user language preference detection via `getUserConfig().applicationLanguage`, which defaults to 'zh-CN' or can be set by the user.

This is a backend-only change using Bun runtime. The i18n infrastructure needs to:
- Work with Bun's filesystem and module system
- Load translations synchronously for tool registration (which happens at startup)
- Support dynamic language switching based on per-request context
- Be extensible to future tools and other user-facing strings

## Goals / Non-Goals

**Goals:**
- Establish i18next infrastructure in CLI backend module compatible with Bun runtime
- Enable dynamic tool description localization based on user language preference
- Create translation files for English (source) and Simplified Chinese
- Modify `getApplicationContext` tool to use the new i18n system
- Establish a pattern that can be easily replicated for other tools

**Non-Goals:**
- Localizing error messages (future scope)
- Localizing API responses (future scope)
- UI internationalization (handled by separate frontend i18n system)
- Language detection from HTTP headers (using existing user config only)
- Translation management UI (manual JSON file editing)

## Decisions

### 1. i18next with i18next-fs-backend

**Choice**: Using `i18next` as the i18n framework with `i18next-fs-backend` for loading translations from JSON files.

**Rationale**:
- i18next is the industry-standard for JavaScript/TypeScript internationalization
- Excellent Bun compatibility (no Node.js specific dependencies)
- fs-backend allows loading translations from filesystem at runtime
- Supports namespace organization (critical for scaling to many tools)
- Well-maintained and mature ecosystem

**Alternatives Considered**:
- *Custom i18n solution*: Would require building translation loading, interpolation, pluralization from scratch. Not worth the maintenance burden.
- *i18next-http-backend*: Not suitable since we're running server-side with direct filesystem access.
- *Inline translation objects*: Would require recompiling for translation changes, doesn't scale.

### 2. Translation File Structure

**Choice**: Namespace-based JSON files organized by locale.

**Structure**:
```
cli/public/locales/
  en/
    tools.json          # All tool descriptions
    common.json         # Shared strings (future use)
  zh-CN/
    tools.json
    common.json
```

**tools.json format**:
```json
{
  "get-app-context": {
    "description": "Get SMM context:\n  * The media folder user selected/focused on SMM UI\n  * The language in user preferences"
  }
}
```

**Rationale**:
- Namespace separation keeps translations organized
- Tool names as keys make lookups intuitive: `t('get-app-context.description')`
- JSON format is human-readable and easily editable
- Standard i18next structure familiar to developers

### 3. Synchronous vs Asynchronous Initialization

**Choice**: Initialize i18next synchronously at application startup using `i18next-fs-backend` with synchronous mode.

**Rationale**:
- Tool descriptions are needed synchronously during tool registration
- Loading translations at startup is faster than per-request
- No runtime overhead after initial load
- Translations don't change during application lifetime

### 4. Language Resolution Strategy

**Choice**: Create a helper function `getToolLanguage()` that:
1. Gets user config globally via `getUserConfig()`
2. Returns language preference (defaults to 'zh-CN' per existing behavior)
3. Falls back to 'en' if translation key missing (i18next default behavior)

**Rationale**:
- Reuses existing language detection infrastructure
- Maintains consistency with current `getLanguage()` function
- Simpler implementation without per-client complexity
- Graceful fallback to English ensures tools always work
- All users share the same language preference from global config

### 5. Integration Pattern for Tools

**Choice**: Create a utility function `getLocalizedToolDescription(toolName: string)` that tools can use to get translated descriptions.

**Pattern**:
```typescript
// Tool definition changes from:
description: `Hard-coded English text`

// To:
description: await getLocalizedToolDescription('get-app-context')
```

**Rationale**:
- Minimal code change required per tool
- Centralizes i18n logic
- Clear, explicit about what's being translated
- Type-safe (tool name is string literal)
- Simpler API without clientId parameter complexity

## Risks / Trade-offs

### Risk: Translation File Maintenance Burden

**Risk**: As more tools are added, keeping translation files synchronized becomes manual and error-prone.

**Mitigation**:
- Establish clear convention: add English key first, validate tool works, then add translations
- Document the pattern in developer guide
- Consider adding a linting rule to check translation completeness (future)
- TypeScript interfaces can enforce required keys (future enhancement)

### Risk: Missing Translations

**Risk**: If a translation key is missing in a language, users see English fallback, which may not match expectations.

**Mitigation**:
- i18next automatically falls back to English if key missing
- Document this behavior clearly
- In production, could log warnings for missing translation keys (future)
- Consider adding a translation completeness checker in CI (future)

### Risk: Performance Impact

**Risk**: Loading all translations at startup could slow application boot time.

**Mitigation**:
- Translation files are small (KB scale, not MB)
- Filesystem reads are cached by OS after first load
- Can benchmark startup time before/after (should be negligible)
- If problematic, can lazy-load per language in future (unlikely needed)

### Trade-off: Initial Scope Limited to One Tool

**Trade-off**: Only modifying `getApplicationContext` tool initially, leaving other tools in English.

**Justification**:
- Proves the pattern before applying broadly
- Allows iteration on the approach
- Reduces risk of breaking all tools at once
- Can migrate other tools incrementally based on priority

## Migration Plan

### Phase 1: Infrastructure Setup (No Breaking Changes)
1. Install dependencies: `bun add i18next i18next-fs-backend`
2. Create `cli/src/i18n/config.ts` with i18next initialization
3. Create `cli/src/i18n/helpers.ts` with utility functions
4. Create translation directory structure: `cli/public/locales/en/`, `cli/public/locales/zh-CN/`
5. Create `tools.json` files with initial translations
6. Add i18n initialization to server startup (`cli/server.ts`)

### Phase 2: Tool Migration
1. Modify `getApplicationContext.ts`:
   - Import `getLocalizedToolDescription`
   - Replace hard-coded description with function call
   - Test with language preference set to 'en' and 'zh-CN'

### Phase 3: Validation
1. Test tool registration with both languages
2. Verify English fallback works for missing keys
3. Check startup time impact
4. Test with invalid/missing language preferences

### Rollback Strategy
If issues arise:
- Revert `getApplicationContext.ts` to use hard-coded description
- Comment out i18n initialization (no-op, translations unused)
- Remove dependencies (optional - can leave unused, no harm)

The migration is additive and doesn't break existing functionality.

## Open Questions

1. **Translation Key Naming Convention**: Should we use tool names directly as keys (`get-app-context`) or add a prefix (`tools.get-app-context`)?
   - **Decision**: Use tool names directly for simplicity and to avoid repetition. i18next namespaces already provide organization.

2. **Should descriptions support interpolation/dynamic values**?
   - **Decision**: Not needed for initial scope. Tool descriptions are static. If needed in future, i18next supports it via `{{variable}}` syntax.

3. **Where to place i18n initialization in startup sequence**?
   - **Decision**: After user config loading, before tool registration. This ensures translations are available when tools are registered.

4. **Global vs per-client language support**?
   - **Decision**: Use global user config language for all tools. This simplifies the implementation and avoids the complexity of passing clientId through the tool registration system. All users share the same language preference from the global configuration.
