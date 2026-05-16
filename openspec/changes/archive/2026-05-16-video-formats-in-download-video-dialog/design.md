## Context

- Download flow: `DownloadVideoDialog` → `buildDownloadVideoJob` → Service Worker → `POST /api/ytdlp/download`.
- CLI accepts any `format` string on download and passes `-f` to yt-dlp.
- Batch downloads (episodes, collections) enqueue many jobs; a single numeric `format_id` from one video’s `-F` list is unreliable across URLs.

## Goals / Non-Goals

**Goals:**

- Quality presets using **format selector expressions** valid across videos on the same platform.
- Same preset applied to every job in a batch.
- No `-F` / executeCmd round-trip for populating the format dropdown.

**Non-Goals:**

- Per-video format pickers.
- Per-video `-F` probing in the dialog.
- Persisting last preset in `localStorage` (deferred).

## Decisions

### 1. Preset table (`apps/ui/src/lib/ytdlpFormatPresets.ts`)

| Preset id | yt-dlp `-f` value |
|-----------|-------------------|
| `default` | *(omit)* |
| `best` | `bestvideo*+ba/b` |
| `1080p` | `bv*[height<=1080]+ba/b[height<=1080]/best` |
| `720p` | `bv*[height<=720]+ba/b[height<=720]/best` |
| `audio` | `bestaudio/best` |

### 2. Dedicated `format` on download API (unchanged)

Optional `format` on `YtdlpDownloadRequestData`; separate from thumbnail `args` allow-list.

### 3. Dialog UX

- Show preset `<Select>` when `hasAgreed && isUrlValid`.
- No loading state for formats; Start not blocked by format fetch.
- `resolveYtdlpFormatFromPreset(presetId)` → `ytdlpFormat` on job.

### 4. Removed `-F` listing path

Deleted `listYtdlpFormats`, `useYtdlpListFormats`, and `parseYtdlpListFormatsStdout` from the UI. `getDownloadProbeUrl` remains for potential future use but is unused by the dialog.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Expression not available on some extractors | User can fall back to default preset; job failure surfaces yt-dlp stderr |
| Expression semantics differ by site | Document in UI; presets are best-effort cross-video |

## Migration Plan

Replace `-F` dropdown with presets in one release. No API or IndexedDB schema changes.
