## Why

`DownloadVideoDialog` always uses yt-dlp defaults, so users cannot choose resolution, codec, or audio-only streams. Exposing format selection before enqueue improves control over file size and quality. Numeric `format_id` values from `-F` do not transfer across videos in batch downloads, so presets must use yt-dlp **format selector expressions**.

## What Changes

- Add **quality presets** in `DownloadVideoDialog` (automatic, best, 1080p, 720p, audio only) mapped to yt-dlp `-f` strings.
- Remove per-video `-F` listing via executeCmd from the dialog (no dedicated list-formats API).
- When downloading **multiple videos**, the same preset expression applies to every job; each video resolves it independently.
- Persist the expression on the download background job and pass it through the Service Worker to **`POST /api/ytdlp/download`**.

## Capabilities

### New Capabilities

- `download-video-format-listing`: Static preset definitions and mapping to yt-dlp format expressions.
- `ytdlp-download-format`: `POST /api/ytdlp/download` optional `format` → `-f`.
- `download-video-dialog-formats`: Dialog UX and job payload for presets.

### Modified Capabilities

<!-- No existing openspec specs define download format behavior. -->

## Impact

- **apps/ui** — `ytdlpFormatPresets.ts`, `DownloadVideoDialog`, job factory, Service Worker, i18n, tests.
- **apps/cli** — download `format` passthrough only (unchanged).
- **packages/core** — no list-formats response types required.
