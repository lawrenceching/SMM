## Why

The application needs the ability to download videos using yt-dlp. This requires a new HTTP API endpoint to accept download requests with optional command-line arguments.

## What Changes

- Add `POST /api/ytdlp/download` endpoint to download videos using yt-dlp
- Support `url` (required) and `args` (optional) in request body
- Only allow `--write-thumbnail` and `--embed-thumbnail` as args

## Capabilities

### New Capabilities
- `ytdlp-download`: HTTP API to download videos using yt-dlp with optional thumbnail arguments

### Modified Capabilities
(none - extends existing ytdlp-http-api)

## Impact

- New file: `apps/cli/src/route/ytdlp/Download.ts`
- Updated: `apps/cli/server.ts` (register new route)
