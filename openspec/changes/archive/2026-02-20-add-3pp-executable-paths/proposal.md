## Why

Users need to specify custom paths to yt-dlp and ffmpeg executables instead of relying on system PATH or bundled binaries. This is essential for users who have these tools installed in non-standard locations or want to use specific versions.

## What Changes

- Add two new input fields in GeneralSettings UI:
  - `ytdlpExecutablePath` - Path to yt-dlp executable
  - `ffmpegExecutablePath` - Path to ffmpeg executable
- Both fields are optional - if empty, the system will fall back to default behavior (system PATH or bundled binaries)
- Both fields support browsing via file picker

## Capabilities

### New Capabilities
None - this is a simple UI addition to existing user-config feature.

### Modified Capabilities
- `user-config`: Add two new optional config fields (`ytdlpExecutablePath`, `ffmpegExecutablePath`) to the user configuration schema

## Impact

- `apps/ui/src/components/ui/settings/GeneralSettings.tsx` - Add input fields for executable paths
- `packages/core/types.ts` - Already contains `ytdlpExecutablePath` and `ffmpegExecutablePath` fields (no changes needed)
