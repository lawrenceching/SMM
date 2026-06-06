# Language Display — Native Names for UI

Use native-language names ("中文", "English", "日本語") instead of API English names
("Mandarin", "English", "Japanese") in the `MediaDatabaseSearchbox` language dropdown.
Pure UI change — the underlying language codes remain unchanged.

[ ] New UI component - no
[ ] New user config - no
[ ] Electron only - no
[ ] User document - no

## 1. Background

Currently, the language dropdown displays names from the TMDB / TVDB APIs directly:

| Source | Code | Current Display |
|--------|------|----------------|
| TMDB API | `zh-CN` | `Mandarin (zh-CN)` |
| TVDB API | `zho`  | `Chinese - China (zho)` |

Two problems:
1. **Inconsistent across databases** — same language shows different names depending on
   whether the user is in TMDB or TVDB mode.
2. **Not user-friendly** — "Mandarin" is not a widely understood term for Chinese
   speakers; "Chinese - China" is a TVDB label, not a natural name.

### Solution

Introduce a hardcoded lookup of **native-language names** for a common language
subset (≈30 languages). Each language displays its name in its own script:
`中文`、`English`、`日本語`、`Français`.

Languages not in the subset fall back to API-provided English name, or the raw
language code if no English name is available.

## 2. Project Level Architecture

None.

## 3. App Level Architecture

New file: `apps/ui/src/lib/languageNativeNames.ts`

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/ui/src/lib/languageNativeNames.ts                           │
│                                                                    │
│  LANGUAGE_NATIVE_NAMES: Map<string, string>                       │
│    • keyed by IETF (zh-CN), ISO 639-1 (zh), ISO 639-3 (zho)      │
│    • values are native names: 中文, English, 日本語               │
│                                                                    │
│  getLanguageDisplayName(code, apiEnglishName?) → string           │
│    1. Look up in LANGUAGE_NATIVE_NAMES → native name              │
│    2. Fallback: apiEnglishName → English name                     │
│    3. Fallback: code → raw code                                   │
│    4. Always format as: "name (code)"                             │
└──────────────────────────────────────────────────────────────────┘

Consumers (unchanged interface):
  useTmdbSearchLanguageOptions  → calls getLanguageDisplayName(code, english)
  useTvdbSearchLanguageOptions  → calls getLanguageDisplayName(code, english)
```

## 4. User Stories

### 4.1 Show native language names in the dropdown

* **Given** - Language data has been fetched from TMDB / TVDB API
* **When** - The user opens the language dropdown
* **Then** - Priority languages show native names: `中文 (zh-CN)`, `English (en-US)`, `日本語 (ja-JP)`
* **And** - Languages outside the common subset show API English name or code as fallback

### 4.2 Show native language names in the trigger (collapsed value)

* **Given** - User has selected a language via the dropdown
* **When** - The dropdown is collapsed (not open)
* **Then** - The trigger displays the native name for the selected language
* **And** - `<SelectValue />` (bare Radix lookup) finds the matching `SelectItem` because the
  code is unchanged — only the `name` field is replaced

### 4.3 TVDB languages display the same native names as TMDB

* **Given** - User switches the search database to TVDB
* **When** - The language dropdown opens
* **Then** - `eng` shows `English (eng)`, `zho` shows `中文 (zho)`, `jpn` shows `日本語 (jpn)`
* **And** - These match the native names shown for `en-US`, `zh-CN`, `ja-JP` in TMDB mode

## 5. Tasks

### 5.1 Language Native Name Map

[x] Create `apps/ui/src/lib/languageNativeNames.ts`:
  - A `LANGUAGE_NATIVE_NAMES` `Map<string, string>` with keys in all three
    formats (IETF, ISO 639-1, ISO 639-3):
      ```
      "zh-CN" → "中文", "zh" → "中文", "zho" → "中文"
      "en-US" → "English", "en" → "English", "eng" → "English"
      "ja-JP" → "日本語", "ja" → "日本語", "jpn" → "日本語"
      ...
      ```
  - `getLanguageDisplayName(code: string, apiEnglishName?: string): string`
    * If code is in map → `${nativeName} (${code})`
    * Else if apiEnglishName → `${apiEnglishName} (${code})`
    * Else → code (bare, no parentheses)

### 5.2 Integrate into TMDB language options

[x] Modify `useTmdbSearchLanguageOptions` in `apps/ui/src/hooks/useTmdbLanguages.ts`:
  - Replace `${english} (${tag})` with `getLanguageDisplayName(tag, english)`
  - `english` comes from `lang?.english_name` (already available)
  - No other logic changes
  - Removed unused `buildTmdbLanguageNameMap` helper

### 5.3 Integrate into TVDB language options

[x] Modify `useTvdbSearchLanguageOptions` in `apps/ui/src/hooks/useTvdbLanguages.ts`:
  - Replace `${english} (${lang.id})` with `getLanguageDisplayName(lang.id, lang.name)`
  - `lang.name` is the TVDB English name (e.g. "Chinese")
  - No other logic changes

### 5.4 Pre-fill the fallback items in MediaDatabaseSearchbox

[x] When `activeLanguageOptions` is `undefined` (loading), the fallback items
  currently use `{ code, name: code }`. Update them to use
  `{ code, name: getLanguageDisplayName(code) }` so the loading placeholder
  already shows native names (no flash of codes).

### 5.5 Tests

[x] Add unit test for `getLanguageDisplayName`:
  - Known code returns native name
  - Unknown code with English name returns English name
  - Unknown code without English name returns raw code
  - All three code formats (IETF, ISO 639-1, ISO 639-3) resolve correctly
[x] Update `useTmdbLanguages.test.tsx` to verify native name output
[x] Update `useTvdbLanguages.test.tsx` to verify native name output
[x] Update `MediaDatabaseSearchbox.test.tsx` to verify fallback items use native names

## 6. Common Language Subset

The following ≈30 languages are included in the native-name map:

| Native Name | IETF | ISO 639-1 | ISO 639-3 |
|-------------|------|-----------|-----------|
| 中文 | zh-CN | zh | zho |
| English | en-US | en | eng |
| 日本語 | ja-JP | ja | jpn |
| Français | fr-FR | fr | fra |
| Deutsch | de-DE | de | deu |
| Español | es-ES | es | spa |
| Português | pt-BR | pt | por |
| Italiano | it-IT | it | ita |
| 한국어 | ko-KR | ko | kor |
| Русский | ru-RU | ru | rus |
| العربية | ar-SA | ar | ara |
| हिन्दी | hi-IN | hi | hin |
| ไทย | th-TH | th | tha |
| Tiếng Việt | vi-VN | vi | vie |
| Türkçe | tr-TR | tr | tur |
| Nederlands | nl-NL | nl | nld |
| Polski | pl-PL | pl | pol |
| Svenska | sv-SE | sv | swe |
| Norsk | no-NO | no | nor |
| Dansk | da-DK | da | dan |
| Suomi | fi-FI | fi | fin |
| Čeština | cs-CZ | cs | ces |
| Română | ro-RO | ro | ron |
| Magyar | hu-HU | hu | hun |
| Ελληνικά | el-GR | el | ell |
| Українська | uk-UA | uk | ukr |
| עברית | he-IL | he | heb |
| Bahasa Indonesia | id-ID | id | ind |
| Bahasa Melayu | ms-MY | ms | msa |
| فارسی | fa-IR | fa | fas |

## 7. Backward Compatibility

None. The `code` field in `TmdbSearchLanguageOption` and `TvdbSearchLanguageOption`
is unchanged. Only the `name` field (used for display) is replaced.
All downstream logic (localStorage, mutation hooks, search queries) operates on
`code`, not `name`.

## 8. Post Verification

[ ] Unit tests — `pnpm test` passes
[ ] Build — `pnpm build` succeeds
[ ] Typecheck — `pnpm typecheck` clean
[ ] Manual smoke test: open language dropdown, verify native names appear
