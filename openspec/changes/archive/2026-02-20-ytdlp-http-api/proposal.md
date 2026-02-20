## Why

The application needs yt-dlp integration to support downloading videos from YouTube or Bilibili. Before implementing download functionality, we need HTTP APIs to discover the yt-dlp binary and verify its availability.

## What Changes

- Add `GET /api/ytdlp/discover` - discovers yt-dlp binary executable path
- Add `GET /api/ytdlp/version` - returns yt-dlp version from `yt-dlp --version`

## Capabilities

### New Capabilities
- `ytdlp-discover`: API to discover yt-dlp binary path
- `ytdlp-version`: API to get yt-dlp version

### Modified Capabilities
(none)

## Impact

- New files: `apps/cli/src/route/ytdlp/Discover.ts`, `apps/cli/src/route/ytdlp/Version.ts`
- New utility: `apps/cli/src/utils/Ytdlp.ts`
- Updated: `apps/cli/server.ts` (registered new routes)
