## 1. CLI: VideoCaptioner synthesize command and HTTP API

- [x] 1.1 In `apps/cli/src/utils/VideoCaptioner.ts`, add typed literals and TS types for synthesize CLI options (at minimum `subtitleMode` soft|hard, `quality` ultra|high|medium|low, optional `style`, optional `renderMode` ass|rounded, optional `layout` if supported).
- [x] 1.2 Add `synthesizeWithVideoCaptioner(videoPath, subtitlePath, options)` building argv `['synthesize', videoPath, '-s', subtitlePath, ...]`, using the same discovery, env (`useBundledFfmpegForVideoCaptioner`), timeout policy (dedicated constant if needed), and stderr truncation as translate/transcribe.
- [x] 1.3 Create `apps/cli/src/route/videocaptioner/Synthesize.ts` with zod-validated `POST /api/videocaptioner/synthesize` handler mirroring `Translate.ts` patterns.
- [x] 1.4 Register the route next to existing videocaptioner routes.
- [x] 1.5 Add `VideoCaptioner.test.ts` / route test cases for argv construction, validation failures, missing files, missing executable, timeout.
- [x] 1.6 Document `videocaptioner/synthesize` in `docs/api/index.md`.

## 2. Shared types and IndexedDB

- [x] 2.1 In `apps/ui/src/types/background-jobs.ts`, add `SynthesizeBackgroundJob` (`type: 'synthesize'`), data shape (folder, video/subtitle POSIX + platform paths, options, title), and union / type guard updates.
- [x] 2.2 In `apps/ui/src/lib/downloadTaskDb.ts`, add `saveSynthesizeJob` (and related getters/filters) mirroring translate.
- [x] 2.3 Add `apps/ui/src/lib/synthesizeJobFactory.ts` with `buildSynthesizeJob(...)`.
- [x] 2.4 Update `useJobManager` / prefixes so `synthesize` jobs are listed consistently.

## 3. Service worker synthesize handlers

- [x] 3.1 Extend `apps/ui/public/download-service-worker.js` with `startSynthesize` / `stopSynthesize` / `removeSynthesize` and heartbeat events mirroring translate.
- [x] 3.2 Route `synthesize:start|stop|remove` in the message switch; extend `handleSwReactivate` for stale `running` synthesize records.

## 4. useSynthesizeManager and IndexedDbObserver

- [x] 4.1 Add `apps/ui/src/hooks/useSynthesizeManager.ts` mirroring `useTranslateManager` (prefixes, autoStart key, path keys from media path when present).
- [x] 4.2 Extend `IndexedDbObserver.tsx` for `type === 'synthesize'`.
- [x] 4.3 Add unit tests for the manager (path sets, basic message handling) if a transcribe/translate manager test pattern exists.

## 5. SynthesizeSubtitleDialog

- [x] 5.1 Extend `apps/ui/src/components/dialogs/types.ts` with row types, confirm payload, and props for `SynthesizeSubtitleDialog` / `UISynthesizeSubtitleDialog`.
- [x] 5.2 Add `UISynthesizeSubtitleDialog.tsx` (options + row list + confirm/cancel).
- [x] 5.3 Add `SynthesizeSubtitleDialog.tsx` (enqueue via `buildSynthesizeJob` + `saveSynthesizeJob`, toasts on missing folder).
- [x] 5.4 Export from `apps/ui/src/components/dialogs/index.ts`.
- [x] 5.5 Add dialog unit tests (defaults, persistence, eligibility, confirm payload).

## 6. Dialog row builders

- [x] 6.1 Add helpers to derive synthesize rows from TV/movie `MediaMetadata` and from music rows (video-only + sibling subtitle), with stable ids.
- [x] 6.2 Unit tests for builders (eligible/ineligible, stable ids).

## 7. MusicFileTable synthesize status and submenu

- [x] 7.1 Extend `MusicFileTable` row props with `synthesizeStatus`, `onTrackSynthesize`, `onSynthesizeStop`, `isSynthesizeAvailable`; add **Synthesize** and **Stop synthesize** under **Subtitle** submenu; title-cell indicators + tooltips.
- [x] 7.2 Update existing table tests; add coverage for submenu gating and stop item visibility.

## 8. Headers: MusicHeaderV2, TvShowHeaderV2, MovieHeaderV2

- [x] 8.1 Add **Synthesize** item and props (`onSynthesizeClick`, `isSynthesizeAvailable`, `hasSynthesizeTargets`) to each header; preserve existing testids on **Transcribe** items.
- [x] 8.2 Extend header tests for three-child menu, parent disabled when all children disabled, synthesize opens dialog.

## 9. Panel wiring

- [x] 9.1 Wire `MusicPanel`: `useSynthesizeManager`, row status, header/table handlers, render `SynthesizeSubtitleDialog`.
- [x] 9.2 Wire `TvShowPanel` and `MoviePanel` similarly (state, rows, availability, dialog).

## 10. i18n

- [x] 10.1 Add English keys under `apps/ui/public/locales/en/components.json` for submenu labels, dialog strings, tooltips, and toasts; mirror in `zh-CN`, `zh-HK`, `zh-TW`.

## 11. Verification

- [x] 11.1 Run `pnpm typecheck` and fix new issues from this change.
- [x] 11.2 Run targeted `pnpm test:cli` / `pnpm test:ui` for touched packages.
- [x] 11.3 Run `openspec validate synthesize-subtitle`.
