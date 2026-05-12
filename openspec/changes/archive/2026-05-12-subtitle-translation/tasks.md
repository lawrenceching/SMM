## 1. CLI: VideoCaptioner translate command

- [x] 1.1 In `apps/cli/src/utils/VideoCaptioner.ts`, add `VIDEOCAPTIONER_TRANSLATORS = ['bing','google','llm'] as const`, `VIDEOCAPTIONER_SUBTITLE_LAYOUTS = ['target-above','source-above','target-only','source-only'] as const`, and corresponding TS types.
- [x] 1.2 In `apps/cli/src/utils/VideoCaptioner.ts`, add `translateSubtitleWithVideoCaptioner(subtitlePath, options)` that builds argv `['subtitle', subtitlePath, '--translator', X, '--target-language', Y, '--no-optimize', '--no-split', ...]`, appends `--reflect`, `--layout`, `--api-key`, `--api-base`, `--model` when set, runs the binary with the same env / `useBundledFfmpegForVideoCaptioner` handling as `transcribeWithVideoCaptioner`, and resolves with `{ success?: true } | { error: string }` (timeout = `TRANSCRIBE_TIMEOUT_MS`; truncate stderr to 500 chars on error).
- [x] 1.3 Create `apps/cli/src/route/videocaptioner/Translate.ts` exporting `processVideoCaptionerTranslate(body)` and `handleVideoCaptionerTranslate(app)` for `POST /api/videocaptioner/translate`. Validate body with `zod`: `subtitlePath: z.string().min(1)`, `translator: z.enum(VIDEOCAPTIONER_TRANSLATORS)`, `targetLanguage: z.string().min(1)`, `reflect: z.boolean().optional()`, `layout: z.enum(VIDEOCAPTIONER_SUBTITLE_LAYOUTS).optional()`, `llm: z.object({ apiKey: z.string().min(1), apiBase: z.string().optional(), model: z.string().optional() }).optional()`. Reject `translator==='llm'` with missing `llm.apiKey` as a 400.
- [x] 1.4 Register `handleVideoCaptionerTranslate` in the cli router (same place `handleVideoCaptionerTranscribe` is registered).
- [x] 1.5 Add `apps/cli/src/utils/VideoCaptioner.test.ts` cases for: argv ordering, `--reflect`/`--layout` inclusion, LLM-flag passthrough, missing-file error, executable-not-found error, timeout behavior.
- [x] 1.6 Add `apps/cli/src/route/videocaptioner/Translate.test.ts` cases for: success path, invalid translator, invalid layout, missing fields, LLM-without-apikey rejection.
- [x] 1.7 Document the endpoint in `docs/api/index.md` (add `videocaptioner/translate` entry mirroring `videocaptioner/transcribe`).

## 2. Shared types and IndexedDB

- [x] 2.1 In `apps/ui/src/types/background-jobs.ts`, add types: `TranslateTranslator = 'bing'|'google'|'llm'`, `TranslateSubtitleLayout`, `TranslateBackgroundJobData` (folder, subtitlePath, subtitlePathPlatform, optional mediaPath / mediaPathPlatform, title, translator, targetLanguage, optional reflect, optional layout, optional llm { apiKey, apiBase?, model? }), `TranslateBackgroundJob` (`type: 'translate'`), and `isTranslateBackgroundJob` type guard. Add `TranslateBackgroundJob` to the `BackgroundJob` discriminated union.
- [x] 2.2 In `apps/ui/src/lib/downloadTaskDb.ts`, add `saveTranslateJob(job: TranslateBackgroundJob): Promise<void>` mirroring `saveTranscribeJob` (stores `type === 'translate'`, sets `folder` from `data.folder`).
- [x] 2.3 Add `apps/ui/src/lib/translateJobFactory.ts` with `buildTranslateJob({ folder, subtitlePath, mediaPath?, title, translator, targetLanguage, reflect?, layout?, llm? })`, normalizing paths via `Path.posix` / `Path.toPlatformPath` and generating the `Translate: <title>` job name.
- [x] 2.4 Update `apps/ui/src/hooks/useJobManager.ts` so `jobType` includes `'translate'` and `messagePrefix` includes `'translate'`; verify no other change is needed (the manager is data-driven via prefixes).

## 3. Service worker translate handlers

- [x] 3.1 In `apps/ui/public/download-service-worker.js`, add `startTranslate(jobId)`, `stopTranslate(jobId)`, `removeTranslate(jobId)` mirroring the transcribe helpers; use `'translate:heartbeat'` as heartbeat event.
- [x] 3.2 In `startTranslate`, build the request body from `data` (use `subtitlePathPlatform` as `subtitlePath`, forward `translator`, `targetLanguage`, optional `reflect`, optional `layout`, optional `llm`) and `POST /api/videocaptioner/translate`. On success → `succeeded` + `translate:succeeded`; on error → `failed` + `translate:failed`; on abort → `stopped` + `translate:stopped`.
- [x] 3.3 Extend the SW `message` handler `switch` to route `translate:start`, `translate:stop`, `translate:remove`.
- [x] 3.4 Extend `handleSwReactivate` so stale `running` `translate` records are flipped to `stopped` on `activate`.

## 4. useTranslateManager and observers

- [x] 4.1 Add `apps/ui/src/hooks/useTranslateManager.ts` mirroring `useTranscribeManager.ts` (use `jobType: 'translate'`, `messagePrefix: 'translate'`, `autoStartKey: 'translate.autoStart'`). Expose `translatingPaths`, `pendingTranslatePaths`, `translateFailedPaths`, `jobIdByPath`, `startTranslate`, `stopTranslate`, `removeTranslate`, `hasRunningTranslate`. Path keys come from `data.mediaPath` (POSIX) when present, otherwise `data.subtitlePath` (POSIX).
- [x] 4.2 Update `apps/ui/src/components/IndexedDbObserver.tsx` so `type === 'translate'` records are reflected in the global `backgroundJobsStore` alongside `transcribe` / `download-video`.
- [ ] 4.3 Add `apps/ui/src/hooks/useTranslateManager.test.tsx` parallel to any existing transcribe-manager test, covering path-set derivation and basic SW events.

## 5. SubtitleTranslationDialog

- [x] 5.1 In `apps/ui/src/components/dialogs/types.ts`, add `SubtitleTranslationDialogRow` (id, path POSIX, displayPath?, title?, mediaPath?, eligible: boolean, disabledReason?: string), `SubtitleTranslationConfirmPayload` (selectedIds, translator, targetLanguage, optional reflect, optional layout, optional llm), `UISubtitleTranslationDialogProps`, and `SubtitleTranslationDialogProps = Omit<...,'onConfirm'>`.
- [x] 5.2 Add `apps/ui/src/components/dialogs/UISubtitleTranslationDialog.tsx` (presentational): renders eligible/ineligible rows with checkbox, **Translator** Select, **Target language** input, conditional LLM inputs (`API Key`, `API Base`, `Model`, `Reflect`), optional **Layout** select; persists `subtitleTranslation.translator` and `subtitleTranslation.targetLanguage` to `localStorage` on confirm; uses Shadcn UI primitives.
- [x] 5.3 Add `apps/ui/src/components/dialogs/SubtitleTranslationDialog.tsx` (smart): on confirm, for each selected eligible row, `buildTranslateJob` + `saveTranslateJob`; closes dialog if at least one enqueued; toast on missing folder.
- [x] 5.4 Export `SubtitleTranslationDialog` (and `UISubtitleTranslationDialog`) from `apps/ui/src/components/dialogs/index.ts`.
- [ ] 5.5 Add `apps/ui/src/components/dialogs/UISubtitleTranslationDialog.test.tsx` covering: default values, persisted-prefs read, LLM-only conditional fields, eligibility filtering, confirm payload shape.
- [ ] 5.6 Add `apps/ui/src/components/dialogs/SubtitleTranslationDialog.test.tsx` covering: enqueue calls `saveTranslateJob` per eligible row, skips ineligible rows, toast on missing folder.

## 6. Dialog row builders

- [x] 6.1 In `apps/ui/src/lib/transcribeDialogRows.ts` (or a new `apps/ui/src/lib/subtitleTranslationDialogRows.ts`), add `subtitleTranslationDialogRowsFromMediaFiles(mediaMetadata)`: for each `MediaFileMetadata`, emit one eligible row per `subtitleFilePaths` entry; when missing, emit one ineligible row with reason key `subtitleTranslationDialog.noSubtitleFile`.
- [x] 6.2 Add `subtitleTranslationDialogRowsFromMusicFileRows(rows, mediaFolderPath)`: derive sibling subtitle path candidates (`.srt` / `.ass`) for each music row's resolved POSIX path; emit eligible rows when the sibling exists in `mediaMetadata.files`, otherwise ineligible.
- [ ] 6.3 Unit tests for both builders covering eligible/ineligible mapping and stable IDs.

## 7. MusicFileTable: Subtitle submenu and translate status

- [x] 7.1 In `apps/ui/src/components/MusicFileTable.tsx`, extend `MusicFileRow` with `translateStatus?: 'running' | 'failed'` and `MusicFileTableProps` with `onTrackTranslate?(row)`, `onTranslateStop?(row)`, `isTranslateAvailable?`.
- [x] 7.2 Replace the flat **Transcribe** `ContextMenuItem` with a `ContextMenuSub` labeled **Subtitle**. Inside its `ContextMenuSubContent`, render: `Transcribe`, `Stop transcribe` (when `transcribeStatus === 'running'`), `Translate`, `Stop translate` (when `translateStatus === 'running'`). Disable `Translate` when `!row.path || !isTranslateAvailable` or no sibling subtitle.
- [x] 7.3 Add a translate status indicator to the title cell (e.g. `Languages` icon spinner for `running`, error variant for `failed`) with tooltip keys `mediaPlayer.translateRunningTooltip` and `mediaPlayer.translateFailedTooltip`. Keep both indicators visible when transcribe and translate run concurrently.
- [x] 7.4 Update existing `MusicFileTable` unit/component tests for the new submenu structure and ensure the legacy testid `music-multi-select-transcribe`-style hooks still resolve in tests.
- [ ] 7.5 Add tests for: submenu disabled when both children are disabled, Stop translate visibility tied to `translateStatus === 'running'`, dual-indicator rendering.

## 8. MusicHeaderV2, TvShowHeaderV2, MovieHeaderV2: Subtitle dropdown

- [x] 8.1 In `apps/ui/src/components/MusicHeaderV2.tsx`, replace the **Transcribe** `Button` with a **Subtitle** `Button` that opens a `DropdownMenu`. Inside, render `Transcribe` and `Translate` items with the same disable logic moved per-item (Transcribe: `!isTranscribeAvailable || !hasTranscribeTargets`; Translate: `!isTranslateAvailable || !hasTranslateTargets`). Disable the parent `Button` only when both children are disabled. Update props: add `onTranslateClick`, `isTranslateAvailable`, `hasTranslateTargets`. Keep existing testid `music-multi-select-transcribe` on the **Transcribe** menu item.
- [x] 8.2 In `apps/ui/src/components/TvShowHeaderV2.tsx`, do the same refactor: a **Subtitle** `Button` with `DropdownMenu` children **Transcribe** + **Translate**. Add props `onTranslateClick`, `isTranslateAvailable`, `hasTranslateTargets`. Preserve `data-testid="tvshow-header-transcribe"` on the **Transcribe** item.
- [x] 8.3 In `apps/ui/src/components/MovieHeaderV2.tsx`, do the same refactor with analogous props and testids (`data-testid="movie-header-transcribe"` if it exists; add `movie-header-translate`).
- [ ] 8.4 Update / extend `TvShowHeaderV2.test.tsx` and `MovieHeaderV2.test.tsx` for the new dropdown structure (transcribe / translate visibility, parent disable when both children disabled).

## 9. MusicPanel wiring

- [x] 9.1 In `apps/ui/src/components/MusicPanel.tsx`, instantiate `useTranslateManager({ platformFolder, onJobSucceeded })` and expose `translatingPaths`, `translateFailedPaths`, `jobIdByPath` as `translateJobIdByPath` etc.
- [x] 9.2 Compute `isTranslateAvailable = isVideoCaptionerReady`.
- [x] 9.3 Build `subtitleTranslationDialogRows` via `subtitleTranslationDialogRowsFromMusicFileRows(...)`; track `hasTranslateTargets`.
- [x] 9.4 In the `tableData` builder, set `translateStatus` to `'running'` when the row's POSIX path is in `translatingPaths`, otherwise `'failed'` when in `translateFailedPaths`.
- [x] 9.5 Add `handleTrackTranslate(row)` and `handleTranslateStop(row)` mirroring the transcribe variants.
- [x] 9.6 Add `handleHeaderTranslateClick` that opens `SubtitleTranslationDialog` with default selection derived from current multi-select tracks (same algorithm as header transcribe).
- [x] 9.7 Render `<SubtitleTranslationDialog .../>` alongside `<TranscribeDialog .../>`, passing rows, default selection, and platform folder.
- [x] 9.8 Pass new props through to `<MusicHeaderV2 .../>` and `<MusicFileTable .../>`.

## 10. TvShowPanel and MoviePanel wiring

- [x] 10.1 In `apps/ui/src/components/TvShowPanel.tsx`, instantiate `useTranslateManager`, build subtitle-translation rows from `mediaMetadata`, compute `isTranslateAvailable` and `hasTranslateTargets`, add `isSubtitleTranslationOpen` state, render `<SubtitleTranslationDialog>`, wire `onTranslateClick` to `<TvShowHeaderV2>`.
- [x] 10.2 In `apps/ui/src/components/MoviePanel.tsx`, repeat the same wiring for the single-movie case.
- [ ] 10.3 (Optional v1) Surface translate-status badges next to TV/Movie episode rows that have an in-flight translate job. If postponed, document this as a follow-up in the change README before archive.

## 11. i18n

- [x] 11.1 In `apps/ui/public/locales/en/components.json`, add: `mediaPlayer.trackContextMenu.subtitle`, `.translate`, `.translateStop`; `mediaPlayer.translateRunningTooltip`, `.translateFailedTooltip`; `subtitleTranslationDialog.title`, `.description`, `.translator`, `.translators.bing|google|llm`, `.targetLanguage`, `.reflect`, `.apiKey`, `.apiBase`, `.model`, `.layout`, `.confirm`, `.cancel`, `.noSubtitleFile`, `.toastStart`, `.toastSucceeded`, `.toastFailed`.
- [x] 11.2 Mirror keys in `zh-CN/components.json`, `zh-HK/components.json`, `zh-TW/components.json` (initial translations may be approximate; mark with TODO in a follow-up note).

## 12. Verification

- [x] 12.1 Run `pnpm typecheck` (root) and fix any new type errors.
- [x] 12.2 Run `pnpm test:cli` and confirm new VideoCaptioner / Translate tests pass.
- [x] 12.3 Run `pnpm test:ui` and confirm new dialog / hook / panel / header tests pass.
- [x] 12.4 Manual smoke test: enqueue a translate job from `MusicPanel` row context menu (Bing translator, `zh-Hans`) and confirm the spinner appears, the SW posts to `/api/videocaptioner/translate`, and the row transitions to a non-running state on completion.
- [x] 12.5 Manual smoke test: refresh the page mid-translate; ensure the SW reactivation flips stale `running` records to `stopped` and the UI reflects this.
- [x] 12.6 Manual smoke test: switch translator to **LLM** with empty API key → confirm dialog blocks confirm.
- [x] 12.7 Manual smoke test: header `Subtitle > Translate` from `TvShowPanel` enqueues one job per selected episode subtitle file.
- [x] 12.8 Run `openspec validate subtitle-translation` and confirm the change is still valid.
