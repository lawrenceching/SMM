## Context

- Download flow: `DownloadVideoDialog` → `buildDownloadVideoJob` → `download-service-worker.js` → `buildYtdlpDownloadArgs` → `POST /api/executeCmd` (`command: "yt-dlp"`).
- `buildYtdlpDownloadArgs` today supports `url`, `folder`, optional `format`, and allow-listed extra `args`. It does not pass `--cookies`.
- `POST /api/writeFile` accepts paths under the user data directory (and media folders). Cookie files belong in user data, not the download destination folder.
- yt-dlp expects Netscape/Mozilla cookie file format; first line must be `# HTTP Cookie File` or `# Netscape HTTP Cookie File` ([FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)).
- **TextDialog** does not exist yet; similar patterns exist (`RenameFileDialog`, `ConfirmationDialog`) in `dialog-provider.tsx`.

## Goals / Non-Goals

**Goals:**

- Let users paste cookie file content, opt in with **Use cookies**, and download with `--cookies` on every video in the job (including batch episodes/collections).
- Write the cookie file once when the user confirms download, before enqueueing the background job.
- Share `buildYtdlpDownloadArgs` changes between main thread, Service Worker bundle, and tests in `packages/core`.

**Non-Goals:**

- `--cookies-from-browser` or automatic browser extraction.
- Persisting cookie text in `localStorage` (session state in the dialog only for this change).
- CLI allow-listing `--cookies` in the generic `args` array (use a dedicated field like `format`).
- Per-video different cookie files within one job.

## Decisions

### 1. TextDialog component

- New `TextDialog` in `apps/ui/src/components/dialogs/text-dialog.tsx`: title, description, controlled `Textarea`, **Save** / **Cancel**.
- Registered in `dialog-provider` via `openTextDialog({ initialValue, title, onConfirm })` mirroring `openRenameFile` pattern.
- `DownloadVideoDialog` keeps `cookiesText` in React state; TextDialog only edits and returns text on confirm.

### 2. DownloadVideoDialog UX

- **Cookie** button (enabled when user has agreed to terms) opens TextDialog with current `cookiesText`.
- **Use cookies** checkbox: when unchecked, downloads proceed without `--cookies` even if text is non-empty.
- **Start** validation: if **Use cookies** is checked and trimmed text is empty, show error toast and do not enqueue.
- Format preset behavior unchanged; cookies apply in addition to optional `ytdlpFormat`.

### 3. Cookie file write timing and path

- On successful validation, before `createJob`:
  1. `writeFile(cookiesPath, cookiesText)` where  
     `cookiesPath = join(userDataDir, 'temp', 'ytdlp-cookies-{jobId}.txt')`  
     (`jobId` from `buildDownloadVideoJob` or pre-generated id passed into factory).
  2. Pass `ytdlpCookiesFile: cookiesPath` on job data only when **Use cookies** and text non-empty.
- Use LF newlines in written content (normalize `\r\n` → `\n`) per yt-dlp FAQ on Windows.
- If `writeFile` fails, toast error and do not enqueue (optimistic UX rollback).

### 4. Core adapter and job data

- Extend `YtdlpDownloadRequestInput` with optional `cookiesFile?: string`.
- In `buildYtdlpDownloadArgs`, after output template and before URL: if `cookiesFile` trimmed non-empty, push `--cookies`, `cookiesFile` (before `-f` / URL is acceptable; order matches yt-dlp docs).
- `DownloadVideoBackgroundJobData`: optional `ytdlpCookiesFile?: string` (absolute path only, not raw text).
- Service Worker passes `cookiesFile: data.ytdlpCookiesFile` into `buildYtdlpDownloadArgs` for each video.

### 5. Cleanup

- After job reaches terminal status (`succeeded` / `failed`), Service Worker or job completion handler SHOULD attempt `deleteFile` / best-effort unlink of `ytdlpCookiesFile` if present. If delete API is unavailable, document leftover files under `userData/temp/` (acceptable for v1).

### 6. Alternatives considered

| Option | Why not |
|--------|---------|
| Store raw cookies on job data | Large, sensitive payload in IndexedDB |
| Pass cookies only via allow-listed `args` | `--cookies` is not in `YTDLP_DOWNLOAD_ALLOWED_ARGS`; dedicated field is clearer |
| Write cookie file in Service Worker | SW lacks pasted text unless duplicated on job; dialog already has it |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Invalid cookie format → yt-dlp HTTP 400 | Document expected format in dialog description; link to yt-dlp FAQ |
| Cookie file left on disk | Best-effort delete after job; path under `userData/temp/` |
| Secrets in logs | Do not log cookie file contents; log path only at debug level |
| Batch job shares one cookie file | Single write per job; same path for all videos (intended) |

## Migration Plan

Single release; no IndexedDB schema migration (optional field on job `data` JSON). Existing jobs without `ytdlpCookiesFile` behave unchanged.

## Open Questions

- Whether to add `deleteFile` API for temp cleanup or use existing file-delete route if one exists.
