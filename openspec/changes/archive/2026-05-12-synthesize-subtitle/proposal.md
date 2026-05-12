## Why

Users who already have subtitles for a video often need a **single output file** (soft-muxed or hard-burned) produced by **VideoCaptioner**’s `synthesize` CLI, without leaving SMM. Today the app supports **Transcribe** and **Translate** under **Subtitle**, but not **Synthesize**, so this workflow is manual outside the app.

## What Changes

- Add **`SynthesizeSubtitleDialog`** (smart + presentational components) to pick one or more **(video, subtitle)** targets, optional **synthesize** options aligned with [VideoCaptioner CLI](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md) (e.g. **`--subtitle-mode`**, **`--quality`**, **`--style`**, **`--render-mode`**, optional font / style overrides as exposed by the CLI), confirm, and enqueue work.
- Extend all **Subtitle** menus (TV show / movie / music headers and **`MusicFileTable`** row submenu) with a **Synthesize** item that opens the new dialog when eligible; add **Stop synthesize** when a row-level **`synthesize`** job is running (mirrors **Stop translate**).
- Add **`POST /api/videocaptioner/synthesize`** and a **`synthesizeWithVideoCaptioner`** (or equivalent) helper in **`apps/cli`** that invokes **`videocaptioner synthesize <videoPath> -s <subtitlePath>`** with validated flags, shared discovery / FFmpeg env handling, timeout, and stderr truncation consistent with transcribe/translate.
- Add **`synthesize`** background jobs: IndexedDB persistence, service worker **`synthesize:*`** messages, **`useSynthesizeManager`** hook, **`IndexedDbObserver`** integration, and optional row/header status indicators for **Music** (and shared toast/lifecycle rules).
- Add **i18n** keys for menu labels, dialog copy, tooltips, and toasts.
- **No breaking changes** to existing transcribe/translate APIs or menu semantics beyond additive menu items and gating rules.

## Capabilities

### New Capabilities

- **`videocaptioner-synthesize-api`**: HTTP route, zod validation, CLI `videocaptioner synthesize` invocation contract, errors, timeout, docs entry in `docs/api/index.md`.
- **`synthesize-subtitle-dialog`**: `SynthesizeSubtitleDialog` / UI shell, row model (video + subtitle paths, eligibility), options UX, confirm → enqueue **`synthesize`** jobs, VideoCaptioner-off gating.
- **`synthesize-background-job`**: Types (`SynthesizeBackgroundJob`), `downloadTaskDb` helpers, SW start/stop/remove + reactivate cleanup, manager hook, job factory, `useJobManager` / prefixes if needed.
- **`synthesize-ui-feedback`**: Background job lifecycle (pending/running/succeeded/failed/stopped), start/success/failure toasts, sequential queue semantics aligned with translate, **`SynthesizeSubtitleDialog`** confirmation feedback from TV/movie/music panels, **Subtitle** menu gating for **Synthesize** when VideoCaptioner is unavailable.
- **`music-panel-synthesize-status`**: **`MusicFileRow`** `synthesizeStatus`, title-cell indicators, **Stop synthesize** in row **Subtitle** submenu, dual-job UX when translate/transcribe also run.

### Modified Capabilities

- **`panel-subtitle-menu`**: **Subtitle** menus gain **Synthesize** (and row **Stop synthesize** when applicable); parent disable logic and per-child gating include synthesize eligibility (VideoCaptioner + resolvable video + subtitle per panel rules); header/row open behavior for **`SynthesizeSubtitleDialog`** with multi-select defaults mirroring **Translate**.
- **`videocaptioner-integration`**: Document **Synthesize** UI gating: enabled only when VideoCaptioner is available (same class of dependency as **Translate**); Tencent ASR does not enable **Synthesize**.

## Impact

- **CLI**: `VideoCaptioner.ts`, new route module under `apps/cli/src/route/videocaptioner/`, router registration, tests, API index.
- **UI**: New dialog components, `dialogs/index.ts`, `MusicFileTable` / headers / panels wiring, hooks, types, SW script, IndexedDB observer, stores as needed.
- **External**: Requires user-installed or bundled **VideoCaptioner** supporting the **`synthesize`** subcommand per upstream CLI docs.
