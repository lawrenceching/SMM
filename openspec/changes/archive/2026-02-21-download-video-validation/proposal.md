## Why

The download video feature currently has minimal input validation — it only checks that the URL and folder fields are non-empty before submitting. There is no URL format validation and no restriction on which video platforms are supported. This means users can submit malformed URLs or URLs from unsupported platforms, resulting in confusing yt-dlp errors. Additionally, the backend accepts any URL without validation, trusting the UI input entirely.

## What Changes

- Add a shared validation module (`download-video-validators.ts`) in `packages/core` that validates:
  - URL is not empty
  - URL is a valid URL format
  - URL is from an allowed platform (Bilibili or YouTube only)
- Integrate validators into the UI dialog (`download-video-dialog.tsx`) to show inline validation hints and prevent invalid requests from being sent
- Integrate validators into the backend route (`Download.ts`) to reject invalid URLs with descriptive error messages before attempting yt-dlp download

## Capabilities

### New Capabilities
- `download-video-validation`: Shared URL validation logic for the video download feature, covering emptiness checks, URL format validation, and allowed-platform whitelist (YouTube, Bilibili)

### Modified Capabilities

## Impact

- **New file**: `packages/core/download-video-validators.ts` — shared validation functions
- **Modified**: `apps/ui/src/components/dialogs/download-video-dialog.tsx` — add client-side validation with user-facing error hints
- **Modified**: `apps/cli/src/route/ytdlp/Download.ts` — add server-side validation before processing download
- **Dependencies**: No new dependencies; URL validation uses the built-in `URL` constructor
