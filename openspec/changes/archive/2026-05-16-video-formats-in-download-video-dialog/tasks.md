## 1. Format presets

- [x] 1.1 Add `ytdlpFormatPresets.ts` with preset id → format expression mapping
- [x] 1.2 Unit tests for `resolveYtdlpFormatFromPreset`
- [x] 1.3 Remove UI `-F` listing (`listYtdlpFormats`, `useYtdlpListFormats`, parser)

## 2. CLI — download with format

- [x] 2.1 Extend `downloadYtdlpVideo` to accept optional `format` and pass `-f` when set
- [x] 2.2 Download route tests for format passthrough

## 3. Job data and Service Worker

- [x] 3.1 `ytdlpFormat` on `DownloadVideoBackgroundJobData`
- [x] 3.2 `buildDownloadVideoJob` persists `ytdlpFormat`
- [x] 3.3 Service Worker passes `format` on download when defined

## 4. DownloadVideoDialog UI

- [x] 4.1 Preset `<Select>` (no executeCmd `-F`)
- [x] 4.2 i18n for preset labels (en, zh-CN, zh-HK, zh-TW)
- [x] 4.3 Dialog tests for default and 1080p preset

## 5. Verification

- [x] 5.1 `pnpm test:cli` and UI vitest for touched files
- [ ] 5.2 Manual smoke: batch download with 1080p preset
