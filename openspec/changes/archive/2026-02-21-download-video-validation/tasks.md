## 1. Shared Validation Module

- [x] 1.1 Create `packages/core/download-video-validators.ts` with `ValidationResult` type and error code constants (`URL_EMPTY`, `URL_INVALID`, `URL_PLATFORM_NOT_ALLOWED`)
- [x] 1.2 Implement `validateDownloadUrl(url: string): ValidationResult` that checks emptiness, URL format via `URL` constructor, and hostname against the YouTube/Bilibili allowlist
- [x] 1.3 Export the allowed hostnames list so it can be referenced in tests
- [x] 1.4 Add unit tests in `packages/core/download-video-validators.test.ts` covering all spec scenarios (empty, whitespace, invalid format, allowed platforms, disallowed platforms)

## 2. UI Integration

- [x] 2.1 Import `validateDownloadUrl` in `download-video-dialog.tsx` and add validation state (`urlError`)
- [x] 2.2 Call the validator on blur and on change (after first interaction) for the URL input, display error message below the input
- [x] 2.3 Keep the download button disabled when validation fails (replace current `!url.trim()` check with validator result)

## 3. Backend Integration

- [x] 3.1 Import `validateDownloadUrl` in `apps/cli/src/route/ytdlp/Download.ts`
- [x] 3.2 Add validation check in `processYtdlpDownload()` before calling `downloadYtdlpVideo()`, returning the validation error with HTTP 400 on failure
- [x] 3.3 Add unit tests for the backend validation in `Download.test.ts` covering empty URL, invalid URL, unsupported platform, and valid URL pass-through
