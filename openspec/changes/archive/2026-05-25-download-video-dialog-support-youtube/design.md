## Context

SMM's DownloadVideoDialog currently supports Bilibili's simple auth model — format presets only, cookies are optional, and format listing is triggered automatically on URL blur. YouTube requires cookies, a JavaScript runtime, and explicit user control over format fetching. The current design cannot support YouTube's requirements.

The detailed UI/UX specification is in `docs/design/ytdlp.md`. This design document covers architectural decisions, component changes, and integration points.

## Goals / Non-Goals

**Goals:**
- Support YouTube video download via the existing DownloadVideoDialog
- Add manual "Go" trigger for `--list-formats` with loading state
- Enforce YouTube cookie requirements (block Go if neither source selected)
- Add JS Runtime selection with QuickJS as default
- Add format code selection from `--list-formats` output
- Bundle QuickJS with the Electron app for all 5 target platforms
- Platform-aware browser filtering (Windows: Firefox only)
- Error handling for both `--list-formats` and download phases

**Non-Goals:**
- Supporting other video platforms beyond Bilibili and YouTube
- Auto-detecting installed JS runtimes on the user's machine
- Caching format listings between sessions
- Downloading format thumbnails or preview images

## Decisions

### D1: `useListFormatsMutation` for format fetching

Use a mutation pattern (not a query) for `--list-formats` since it's explicitly user-triggered, not automatic. The mutation manages loading/error/success states and returns parsed format data.

**Rationale:** Format fetching is side-effect-heavy (spawns yt-dlp process) and user-initiated. A mutation better models this than a query/query hook.

### D2: Cookies section moves between top-level and More Options

Before format fetch, cookies appear at top level for visibility (YouTube requires them). After successful fetch, they move to More Options to reduce UI clutter since the user's attention shifts to format selection.

**Rationale:** This minimizes initial cognitive load while ensuring YouTube users can't miss the cookie requirement.

### D3: Platform-aware browser list filtering

The browser list is filtered at render time based on `process.platform`. On Windows (`win32`), Chrome and Edge are excluded. On macOS/Linux, all three browsers remain.

**Rationale:** `--cookies-from-browser` on Windows cannot decrypt Chrome/Edge cookie stores due to different encryption APIs. Filtering at the UI level prevents user confusion and cryptic yt-dlp errors.

### D4: Three-way format code categorization

Format codes from `--list-formats` are parsed into three groups: `audio only`, `video only`, and combined (both audio and video codecs present). The categorization is determined by the presence of "audio only" / "video only" in the format's `resolution` or `acodec`/`vcodec` fields.

**Rationale:** This grouping matches the natural mental model users have about formats. The supplementary dropdown for audio-only/video-only selections follows the same pattern yt-dlp's `-f` selector uses for format combination (`video_id+audio_id`).

### D5: QuickJS as bundled default, not auto-detected

QuickJS is bundled with the app as the default JS runtime. Users can select Deno, Node.js, or Bun instead, but the app does not auto-detect installed runtimes.

**Rationale:** QuickJS requires no separate installation and works cross-platform. Bundling it guarantees YouTube extraction works out of the box.

### D6: Format code mode hidden during episodes/collection

When downloading episodes or collections, the format code radio group and dropdowns are hidden entirely (no message). Only presets remain visible.

**Rationale:** Per-video format codes in batch scenarios create complexity (different videos have different format IDs). Presets using yt-dlp selector expressions work uniformly across all videos.

## Risks / Trade-offs

- **Format code dropdown can be very long (200+ entries for YouTube):** Users may find scrolling through all formats tedious. Mitigation: the 3-category grouping (audio only / video only / combined) and the supplementary dropdown reduce the number of options visible at once. Future: could add search/filter within the dropdown.
- **QuickJS cosmo binary is a single file for 3 platforms:** The cosmo format (αcτµαlly pδrταblε εxεcµταblε) is relatively niche. If the cosmo build is discontinued, Windows arm64, Linux arm64, and macOS would each need separate binaries. Mitigation: the download script can be updated per-platform as new releases appear.
- **Moving cookies to More Options after fetch could confuse users who want to change cookie settings:** Once cookies are moved, users must expand "More Options" to reconfigure. Mitigation: cookie settings typically don't change after fetching formats — if the fetch succeeded, they're valid.
