## Why

YouTube videos require a JavaScript runtime for yt-dlp format extraction. If the bundled QuickJS binary is missing, corrupted, or was manually deleted, the download silently fails at execution time with a cryptic yt-dlp error. Checking availability at Go-click time gives users immediate, actionable feedback.

## What Changes

- After Go button click for YouTube URLs, probe whether a QuickJS binary is available (via `fetchDiscoverExecutables` or equivalent)
- If QuickJS is not found, display error "无法找到JavaScript运行时" and disable the Start button
- The check applies only to YouTube URLs (Bilibili and other platforms are unaffected)

## Capabilities

### New Capabilities
- `quickjs-availability-check`: Proactive check that a QuickJS binary is discoverable before allowing download of YouTube videos

### Modified Capabilities
- `js-runtime-selection`: Add requirement that for YouTube URLs, QuickJS availability is verified at Go-click time, and Start is blocked if unavailable

## Impact

- `use-download-video-form.ts` — `handleGo` logic updated to check QuickJS availability for YouTube URLs
- `useListFormatsMutation.ts` — may be extended or a separate probe used
- `ExternalApplicationsSettings.tsx` — reference pattern for QuickJS discovery (`fetchDiscoverExecutables`)
- Error messages UI in `UIDownloadVideoDialogContent` — new error type display
