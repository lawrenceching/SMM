## 1. CLI: VideoCaptioner `process` command and HTTP API

- [x] 1.1 In `apps/cli/src/utils/VideoCaptioner.ts`, add `PROCESS_TIMEOUT_MS` and typed literals / TS types for **`process`** options (transcribe leg: `asr`, `language`, `wordTimestamps`, `format`; subtitle leg: `translator`, `targetLanguage`, `noOptimize`, `noTranslate`, `noSplit`, optional `reflect` / `layout` / `prompt`; synthesize leg: optional `subtitleMode`, `quality`, `style`, `renderMode`, `layout`; boolean `noSynthesize`) aligned with validated CLI surface for v1.
- [x] 1.2 Add `processWithVideoCaptioner(mediaPath, options)` building argv `['process', mediaPath, ...]`, using the same discovery, env (`useBundledFfmpegForVideoCaptioner`), stderr truncation, and kill-on-timeout behavior as existing VideoCaptioner helpers.
- [x] 1.3 Create `apps/cli/src/route/videocaptioner/Process.ts` with zod-validated `POST /api/videocaptioner/process` handler mirroring `Synthesize.ts` / transcribe route patterns (400 on validation, structured error body).
- [x] 1.4 Register the route next to existing videocaptioner routes in `apps/cli/server.ts`.
- [x] 1.5 Add `VideoCaptioner.test.ts` and route tests for argv construction, validation failures, missing `mediaPath` on disk, missing executable, timeout.
- [x] 1.6 Document `videocaptioner/process` in `docs/api/index.md`.

## 2. Shared types and IndexedDB

- [x] 2.1 In `apps/ui/src/types/background-jobs.ts`, add `ProcessBackgroundJob` (`type: 'process'`), data shape (folder, media POSIX + platform paths, flattened pipeline options, title), and union / type guard updates.
- [x] 2.2 In `apps/ui/src/lib/downloadTaskDb.ts`, add `saveProcessJob` (and related getters/filters) mirroring `saveSynthesizeJob`.
- [x] 2.3 Add `apps/ui/src/lib/processJobFactory.ts` with `buildProcessJob(...)`.
- [x] 2.4 Update `useJobManager` / prefixes so `process` jobs are listed consistently.

## 3. Service worker `process` handlers

- [x] 3.1 Extend `apps/ui/public/download-service-worker.js` with `startProcess` / `stopProcess` / `removeProcess` and heartbeat events mirroring `synthesize`.
- [x] 3.2 Route `process:start|stop|remove` in the message switch; extend `handleSwReactivate` for stale `running` `process` records.

## 4. `useProcessManager` and `IndexedDbObserver`

- [x] 4.1 Add `apps/ui/src/hooks/useProcessManager.ts` mirroring `useSynthesizeManager` (prefixes, `autoStartKey`, path keys from media path when present).
- [x] 4.2 Extend `IndexedDbObserver.tsx` for `type === 'process'`.
- [x] 4.3 Add unit tests for the manager (path sets, basic message handling) following existing manager tests if present.

## 5. `ProcessPipelineDialog`

- [x] 5.1 Extend `apps/ui/src/components/dialogs/types.ts` with row types, confirm payload, and props for `ProcessPipelineDialog` / `UIProcessPipelineDialog`.
- [x] 5.2 Add `UIProcessPipelineDialog.tsx` (pipeline options + row list + confirm/cancel).
- [x] 5.3 Add `ProcessPipelineDialog.tsx` (enqueue via `buildProcessJob` + `saveProcessJob`, toasts on missing folder / blocked confirm).
- [x] 5.4 Export from `apps/ui/src/components/dialogs/index.ts`.
- [x] 5.5 Add dialog unit tests (defaults, persistence, eligibility, ASR gating, confirm payload).

## 6. Dialog row builders

- [x] 6.1 Add helpers to derive **process** rows from TV/movie `MediaMetadata` and from music tracks (same path eligibility as transcribe where applicable), with stable ids.
- [x] 6.2 Unit tests for builders (eligible/ineligible, stable ids).

## 7. `MusicFileTable` process status and submenu

- [x] 7.1 Extend `MusicFileTable` row props with `processStatus`, `onTrackProcess`, `onProcessStop`, `isProcessAvailable`; add **Process** and **Stop process** under **Subtitle** submenu; title-cell indicators + tooltips.
- [x] 7.2 Update existing table tests; add coverage for submenu gating and **Stop process** visibility.

## 8. Headers: `MusicHeaderV2`, `TvShowHeaderV2`, `MovieHeaderV2`

- [x] 8.1 Add **Process** item and props (`onProcessClick`, `isProcessAvailable`, `hasProcessTargets`) to each header; preserve existing testids on **Transcribe** items.
- [x] 8.2 Extend header tests for five-child menu, parent disabled when all children disabled, **Process** opens `ProcessPipelineDialog`.

## 9. Panel wiring

- [x] 9.1 Wire `MusicPanel`: `useProcessManager`, row status, header/table handlers, render `ProcessPipelineDialog`.
- [x] 9.2 Wire `TvShowPanel` and `MoviePanel` similarly (state, rows, availability, dialog).

## 10. i18n

- [x] 10.1 Add English keys under `apps/ui/public/locales/en/components.json` for **Process** labels, dialog strings, tooltips, and toasts; mirror in `zh-CN`, `zh-HK`, `zh-TW`.
- [x] 10.2 Extend `apps/ui/src/types/i18next.d.ts` if required for new keys.

## 11. Verification

- [x] 11.1 Run `pnpm typecheck` and fix new issues from this change.
- [x] 11.2 Run targeted `pnpm test:cli` / `pnpm test:ui` for touched packages.
- [x] 11.3 Run `openspec validate process-subtitle`.
