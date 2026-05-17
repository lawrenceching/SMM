## Why

Many sites (e.g. YouTube, Bilibili) require authenticated sessions or CAPTCHA clearance before yt-dlp can download. Users already export Netscape-format cookie files from browsers or extensions; the app should let them paste that content and pass it to yt-dlp via `--cookies` without leaving the download flow.

## What Changes

- Add a reusable **TextDialog** for multiline text entry (used first for cookies).
- In **DownloadVideoDialog**: **Cookie** button opens TextDialog; **Use cookies** checkbox gates whether cookies apply on download.
- On **Start**, when cookies are enabled and non-empty: write cookie text to a `.txt` file under the user data directory via **`POST /api/writeFile`**, then store the file path on the download job.
- Extend the **executeCmd yt-dlp download adapter** and Service Worker to pass **`--cookies <path>`** for every video in the job when a cookies file path is present.
- i18n strings and unit tests for adapter, job factory, dialog, and TextDialog.

## Capabilities

### New Capabilities

- `text-dialog`: Reusable dialog with a multiline text area, confirm/cancel, and optional title/description; returns edited text to the caller.
- `ytdlp-download-cookies`: Optional cookies file path on download jobs; `buildYtdlpDownloadArgs` adds `--cookies` when set; Service Worker applies it per video via executeCmd.
- `download-video-dialog-cookies`: Download Video dialog UX for entering cookies, enabling them, and persisting a cookies file path on enqueue.

### Modified Capabilities

- `execute-cmd-client-adapters`: Download adapter scenario SHALL include optional cookies file path in the constructed yt-dlp argv.

## Impact

- **apps/ui** — new `TextDialog`, `DownloadVideoDialog`, `downloadVideoJobFactory`, `DownloadVideoBackgroundJobData`, `download-service-worker.js` / `whitelisted-cmd-sw.js`, `packages/core` `buildYtdlpDownloadArgs`, i18n (`dialogs`, `components`), tests.
- **apps/cli** — no API changes; `writeFile` allowlist already covers user data dir for temp cookie files.
- **Security** — cookie files contain session secrets; written only under user data dir; cleanup after job completion is recommended in design.
