## Context

SMM already integrates **VideoCaptioner** for **`transcribe`** and **`subtitle`** (translate) with discovery, bundled FFmpeg PATH, **`TRANSCRIBE_TIMEOUT_MS`**, stderr truncation, and UI entry points under a shared **Subtitle** menu pattern. **VideoCaptioner** exposes **`videocaptioner synthesize <video> -s <subtitle>`** with options such as **`--subtitle-mode`** (`soft` / `hard`), **`--quality`**, **`--style`**, **`--render-mode`**, **`--font-file`**, **`--style-override`**, **`--layout`** (per upstream CLI documentation).

## Goals / Non-Goals

**Goals:**

- Mirror the proven **translate** stack: HTTP API → **optional** long-running work via **service worker** + IndexedDB + manager hook, with sequential job execution per batch and clear toasts.
- Ship **`SynthesizeSubtitleDialog`** and **Subtitle → Synthesize** everywhere **Subtitle → Translate** exists today (TV/movie/music headers + music row submenu), including **Stop synthesize** when a job is running for that row.
- Validate CLI flags on the server; pass platform paths to the child process like other VideoCaptioner routes.

**Non-Goals:**

- Replacing FFmpeg for mux/burn outside VideoCaptioner, or supporting non–VideoCaptioner synthesize backends in v1.
- TV/movie per-episode **inline** synthesize badges in the episode list (optional follow-up; music row indicators are in scope via **`music-panel-synthesize-status`**).
- Preset style gallery UI beyond what the dialog needs (minimal: mode, quality, style name string or select fed by a fixed list / free text per design choice below).

## Decisions

1. **Background job vs synchronous-only**  
   **Decision:** Implement **`synthesize`** as a first-class **`BackgroundJob`** type with SW-driven **`POST /api/videocaptioner/synthesize`**, matching **translate** so long **`synthesize`** runs survive tab refresh and reuse existing job UI patterns.  
   **Alternatives:** Synchronous-only API from renderer (simpler but poor UX for long encodes, no stop). **Rejected.**

2. **Row key for synthesize jobs**  
   **Decision:** Use **POSIX `mediaPath`** when present (video file), else fall back to **POSIX `subtitlePath`** for correlation, aligned with **`useTranslateManager`** path-key strategy so one row maps to one running job.  
   **Alternatives:** Composite key `video|subtitle` string — clearer but more invasive. **Deferred** unless collisions appear.

3. **Music panel eligibility**  
   **Decision:** **Synthesize** applies only when the track’s resolved file is a **video** container (same extension / MIME heuristic used elsewhere for “video” if any; otherwise conservative list e.g. `mp4`, `mkv`, `webm`, `mov`). Audio-only tracks show **Synthesize** disabled with a localized reason.  
   **Alternatives:** Hide item entirely for audio — worse discoverability. **Rejected** in favor of disabled + reason.

4. **Dialog options surface**  
   **Decision:** v1 exposes a **small** fixed set in the dialog: **`subtitleMode`** (`soft` | `hard`), **`quality`** (`ultra` | `high` | `medium` | `low`), optional **`style`** string (preset name), optional **`renderMode`** (`ass` | `rounded`), optional **`layout`** if CLI supports bilingual layout for synthesize. **`fontFile`**, **`styleOverride` JSON** — **optional** behind “Advanced” collapsible or omitted from v1 to limit scope; prefer **omit from v1** unless trivial to wire.  
   **Alternatives:** Full CLI surface in v1 — high bug risk. **Rejected.**

5. **API request shape**  
   **Decision:** **`videoPath`** (platform path to existing video), **`subtitlePath`** (platform path to existing subtitle), plus optional fields mirroring CLI (`subtitleMode`, `quality`, `style`, `renderMode`, `layout`). Zod enums for known literals; reject missing files with 400/404-style error messages consistent with translate route.  
   **Alternatives:** Only POSIX paths in body — inconsistent with existing translate body using `subtitlePathPlatform`. **Follow existing pattern** (`*Path` + `*PathPlatform` in job data; API accepts platform paths like transcribe/translate).

## Risks / Trade-offs

- **[Risk]** Upstream CLI flags differ by VideoCaptioner version → **Mitigation:** document minimum version in proposal/tasks; integration tests mock spawn argv.
- **[Risk]** Hard-burn synthesize is CPU-heavy and may exceed current timeout constant tuned for transcribe → **Mitigation:** consider dedicated **`SYNTHESIZE_TIMEOUT_MS`** (larger) in design implementation phase; document in tasks.
- **[Risk]** Soft-mux overwrites or duplicates output naming → **Mitigation:** rely on VideoCaptioner default output rules; surface stderr on failure; do not silently delete user files (no extra deletes in v1).

## Migration Plan

- No DB migration; new IndexedDB **`type: 'synthesize'`** records alongside existing job types.
- Rollback: remove route, SW branches, UI menu items, and job type (orphaned IndexedDB rows harmless).

## Open Questions

- Exact **default** `subtitleMode` / `quality` for first-time users (recommend **`soft`** + **`medium`** to match CLI defaults per docs).
- Whether **`layout`** on **`synthesize`** is required for v1 or can be omitted until a user request lands.
