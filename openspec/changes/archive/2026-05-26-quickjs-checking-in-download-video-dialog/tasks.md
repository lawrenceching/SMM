## 1. QuickJS Probe in use-download-video-form

- [x] 1.1 Add `quickjsUnavailable` state and a `fetchDiscoverExecutables` call in `handleGo` for YouTube URLs before calling `listFormats`
- [x] 1.2 If QuickJS not found, set `quickjsUnavailable: true` and skip `listFormats`; on re-check success, clear the flag
- [x] 1.3 Add `quickjsUnavailable` to the return type and pass it through to the UI

## 2. Error Display and Start Button in UI

- [x] 2.1 In `UIDownloadVideoDialogContent`, display "无法找到JavaScript运行时" error when `quickjsUnavailable` is true (use `classifyYtdlpError` pattern or a simple conditional)
- [x] 2.2 Disable Start button when `quickjsUnavailable` is true (in `DialogFooter`)
- [x] 2.3 Ensure the error is cleared when URL changes or Go is re-clicked with QuickJS now available

## 3. Test

- [x] 3.1 Add test in `download-video-dialog.test.tsx`: YouTube Go click with QuickJS unavailable shows error and disables Start
- [x] 3.2 Add test: Bilibili Go click skips QuickJS check and proceeds normally
- [x] 3.3 Run full test suite to verify no regressions
