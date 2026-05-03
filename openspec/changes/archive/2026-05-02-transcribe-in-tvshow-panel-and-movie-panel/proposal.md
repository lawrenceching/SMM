## Why

Users can already transcribe media from **MusicPanel**; TV show and movie libraries store episode/main video files in **MediaMetadata.mediaFiles** but have no entry point to run the same VideoCaptioner workflow. Adding a header **Transcribe** action and **TranscribeDialog** for those panels aligns TV/movie workflows with music and reuses existing transcribe feedback (background jobs, toasts).

## What Changes

- Add a **Transcribe** control to the TV show and movie **header** components (parallel to other primary actions).
- When the user clicks **Transcribe**, open **`TranscribeDialog`** with one row per eligible video file derived from **`MediaMetadata.mediaFiles`** (display path, selection, confirm → existing transcribe pipeline).
- Gate the header action when VideoCaptioner is unavailable (same discovery semantics as music).
- No **BREAKING** API changes to HTTP transcribe endpoints; UI-only extension.

## Capabilities

### New Capabilities

- `tv-movie-panel-transcribe`: User-facing transcribe entry from **TvShowPanel** and **MoviePanel**: header button, building **TranscribeDialog** rows from **`mediaFiles`**, confirm delegates to existing transcribe execution (background jobs + toasts).

### Modified Capabilities

- `transcribe-ui-feedback`: Extend requirements so transcribe background-job and toast behavior applies to flows started from **TranscribeDialog** opened by TV/movie panels (not only **MusicPanel** context menu / batch).

## Impact

- **UI**: [`TvShowPanel`](apps/ui/src/components/TvShowPanel.tsx), [`MoviePanel`](apps/ui/src/components/MoviePanel.tsx), shared or panel-specific header components (e.g. toolbar near scrape/recognize).
- **Dialogs**: [`TranscribeDialog`](apps/ui/src/components/dialogs/TranscribeDialog.tsx), [`UITranscribeDialog`](apps/ui/src/components/dialogs/UITranscribeDialog.tsx) (consume only).
- **Data**: [`MediaMetadata`](packages/core) `mediaFiles` → dialog rows (`id`, `path`, `status`, optional `title`).
- **Hooks**: `useVideoCaptionerStatus` for disabling header when captioner missing; optional local state for dialog open/close.
- **Backend**: No new routes; reuse `/api/videocaptioner/transcribe` via existing [`transcribeFeedback`](apps/ui/src/lib/transcribeFeedback.ts).
