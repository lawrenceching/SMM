## 1. TextDialog

- [x] 1.1 Add `TextDialog` component with Textarea, confirm, and cancel
- [x] 1.2 Register `openTextDialog` in `dialog-provider` and export types
- [x] 1.3 Unit test TextDialog confirm/cancel behavior

## 2. Core adapter and types

- [x] 2.1 Extend `YtdlpDownloadRequestInput` and `buildYtdlpDownloadArgs` with optional `cookiesFile` → `--cookies`
- [x] 2.2 Add unit tests in `packages/core` for cookies arg presence/absence
- [x] 2.3 Mirror `buildYtdlpDownloadArgs` change in `whitelisted-cmd-sw.js`
- [x] 2.4 Add `ytdlpCookiesFile?: string` to `DownloadVideoBackgroundJobData` and `buildDownloadVideoJob`

## 3. Cookie file write helper

- [x] 3.1 Add helper to resolve `userData/temp/ytdlp-cookies-{jobId}.txt` and normalize cookie text (LF)
- [x] 3.2 Write via `writeFile` API; surface errors to caller
- [x] 3.3 Unit test path building and newline normalization

## 4. DownloadVideoDialog UI

- [x] 4.1 Add **Cookie** button opening TextDialog; session state for cookie text
- [x] 4.2 Add **Use cookies** checkbox and validation when enabled but empty
- [x] 4.3 On Start: write cookie file when enabled, then enqueue job with `ytdlpCookiesFile`
- [x] 4.4 i18n strings (en, zh-CN, zh-HK, zh-TW) for button, checkbox, validation, TextDialog hints
- [x] 4.5 Dialog tests for cookies enabled/disabled and writeFile failure

## 5. Service Worker

- [x] 5.1 Pass `cookiesFile: data.ytdlpCookiesFile` in `download-service-worker.js` `buildYtdlpDownloadArgs` calls
- [x] 5.2 Best-effort delete cookies temp file when job completes (if delete API exists)

## 6. Verification

- [x] 6.1 Run UI vitest for touched files and core whitelistedCmd tests
- [ ] 6.2 Manual smoke: paste sample Netscape cookies, enable **Use cookies**, download a restricted URL
