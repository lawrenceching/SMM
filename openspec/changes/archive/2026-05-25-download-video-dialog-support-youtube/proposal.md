## Why

YouTube now requires cookies and a JavaScript runtime for video extraction. The current DownloadVideoDialog only supports Bilibili's simpler auth model — it has no manual trigger for format fetching, no JS runtime selection, and no per-platform cookie enforcement. We need to support the full YouTube download flow before the first release.

## What Changes

- Add explicit "Go" button (and Enter key) to manually trigger `ytdlp --list-formats` instead of automatic URL blur
- "Go" button shows a loading spinner during format fetch
- YouTube: require at least one cookie source (manual or browser) before "Go" is enabled
- YouTube: force-enable JS runtime selection (default: QuickJS)
- Move cookies section into "More Options" after formats are successfully fetched
- Filter browser cookie sources by platform (Windows: Firefox only; macOS/Linux: all)
- Add format code mode (from `--list-formats` output) alongside existing preset mode
- Format codes grouped as audio-only, video-only, and audio+video; supplementary dropdown for pairing
- Episodes/collection mode hides format code UI (presets only)
- Bundle QuickJS binary into the Electron app for all 5 target platforms
- Error handling covers both `--list-formats` and download phases with specific messages for cookie expiry and format unavailability

## Capabilities

### New Capabilities

- `quickjs-bundling`: Download and bundle QuickJS binary with the Electron app for Windows (x64, arm64), Linux (x64, arm64), and macOS (arm64)
- `js-runtime-selection`: JS Runtime checkbox and dropdown in the More Options section, force-enabled for YouTube, user-selectable runtime (Deno, Node.js, Bun, QuickJS)
- `video-format-code-selection`: Format code-based format selection from `--list-formats` output, including audio/video supplementary pairing dropdown

### Modified Capabilities

- `download-video-dialog-cookies`: Platform-based browser filtering (Windows excludes Chrome/Edge); Go button disabled for YouTube until a cookie source is selected; cookies section moves to More Options after format fetch
- `download-video-dialog-formats`: New format code mode alongside existing preset mode via radio group; format code UI hidden during episodes/collection mode
- `download-video-format-listing`: Manual trigger via Go button or Enter key replaces URL blur; loading state via `useListFormatsMutation`; format listing now populates format code dropdown with per-video format IDs

## Impact

- **UI**: `UIDownloadVideoDialogContent` and all sub-components in `download-video-dialog/components/`
- **Hooks**: New `useListFormatsMutation`, changes to `useDownloadVideoForm` and `useYtdlpDownloadFlow`
- **Types**: New `YtdlpJsRuntimeId` type, new `YtdlpFormatCode` type, platform-aware browser list
- **CI**: `ci/download-3pp-binary.sh` gains QuickJS download logic
- **Packaging**: `apps/electron/electron-builder.yml` adds `bin/quickjs` extraResources for all platforms
- **Dependencies**: None new; QuickJS binary bundled directly
