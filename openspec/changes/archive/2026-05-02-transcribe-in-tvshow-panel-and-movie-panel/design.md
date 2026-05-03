## Context

**TvShowPanel** and **MoviePanel** render episode/video lists from **TanStack Query** `MediaMetadata`; video paths live in **`mediaFiles`** (`MediaFileMetadata`, including **`absolutePath`**). **MusicPanel** already wires **VideoCaptioner** via **`transcribeTracksWithFeedback`** and **`useVideoCaptionerStatus`**. **`TranscribeDialog`** wraps **`UITranscribeDialog`** and runs the same pipeline using **`useBackgroundJobsStore`**.

## Goals / Non-Goals

**Goals:**

- Expose **Transcribe** in TV/movie **headers** when metadata is loaded and captioner is available.
- Open **`TranscribeDialog`** with rows built from **`mediaMetadata.mediaFiles`** (one row per video file with display path and initial status **pending** unless we later enrich).
- Reuse **`TranscribeDialog`** without duplicating HTTP or job logic.

**Non-Goals:**

- Changing CLI transcribe API or VideoCaptioner binary behavior.
- Live row status updates inside the dialog during sequential transcribe (existing behavior closes dialog then runs jobs + toasts).
- Subtitle output format or TMDB linkage.

## Decisions

1. **Row identity and path**  
   Use a **stable string id** per row (e.g. POSIX-normalized **`absolutePath`** or hash) so selection survives re-renders. **`TranscribeDialogRow.path`** shows **relative path when `mediaFolderPath` exists** (same helpers as episode tables: `relative(mediaFolderPath, absolutePath)`), otherwise absolute.

2. **Header placement**  
   Add **Transcribe** next to existing actions in the panel header/toolbar component each panel already uses (e.g. alongside Scrape / refresh patterns). Exact component split follows existing **TvShow** vs **Movie** header structure in the codebase.

3. **Availability gating**  
   Use **`useVideoCaptionerStatus()`**; disable or hide header **Transcribe** when **`!isAvailable`** (aligned with music context-menu gating).

4. **Empty / no metadata**  
   If **`mediaFiles`** is missing or empty, disable **Transcribe** or open dialog with empty list + empty state (prefer **disable** + tooltip / no-op to avoid noisy empty dialog—final UX can match MusicPanel patterns).

5. **Titles for jobs**  
   Pass **`title`** on **`TranscribeDialogRow`** when derivable (episode label or basename); else **`TranscribeDialog`** already falls back to **`basename(path)`**.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large libraries → huge dialog row count | Acceptable v1; optional filter/folder scope is out of scope per Non-Goals |
| Path format mismatch (POSIX vs platform) | Use **`Path.toPlatformPath`** only at transcribe API boundary (already in **`transcribeFeedback`**) |

## Migration Plan

- Ship UI-only; no DB migration. Rollback: remove header wiring and dialog state.

## Open Questions

- Whether **MoviePanel** uses the same header component as TV or a distinct **MovieHeader** (implementation picks the actual import targets).
