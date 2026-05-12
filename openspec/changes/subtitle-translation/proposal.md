## Why

Users can already generate subtitles in SMM via the existing **Transcribe** flow (VideoCaptioner / Tencent ASR), but produced subtitles are always in the source language. To make subtitles useful for multilingual libraries, SMM must also translate existing subtitle files to a chosen target language. VideoCaptioner's `subtitle` CLI subcommand already supports free and LLM-based translation, so SMM can reuse the existing executable, background-job pipeline, and IndexedDB persistence model to add **Translate** alongside **Transcribe**.

Today the top-level entry point in `TvShowPanel`, `MoviePanel`, and `MusicPanel` is a single `Transcribe` action. Adding `Translate` next to it as a sibling would clutter the toolbar/context menu and conflate two related subtitle operations. Grouping both actions under a `Subtitle` parent (button-with-submenu in headers, submenu in row context menus) keeps the surface compact, signals that they share a domain, and leaves room to add more subtitle-related actions later (e.g. `Synthesize`).

## What Changes

- Add new UI component `SubtitleTranslationDialog` (and matching `UISubtitleTranslationDialog`) for configuring VideoCaptioner `subtitle` translation: subtitle row(s) selection, **Translator** (`bing`, `google`, `llm`), **Target language** (BCP 47 code), and LLM-only options (`reflect`, `apiKey`, `apiBase`, `model`).
- Add new HTTP route `POST /api/videocaptioner/translate` in `apps/cli` that wraps `videocaptioner subtitle <file> --translator ... --target-language ...` and waits for command completion.
- Add new `translate` background-job type:
  - `TranslateBackgroundJob` / `TranslateBackgroundJobData` in `apps/ui/src/types/background-jobs.ts`
  - `buildTranslateJob` + `saveTranslateJob` (analogous to `buildTranscribeJob` + `saveTranscribeJob`)
  - `useTranslateManager` (analogous to `useTranscribeManager`)
  - Service-worker handlers `translate:start` / `translate:stop` / `translate:remove` in `apps/ui/public/download-service-worker.js`
  - `IndexedDbObserver` mapping for `type=translate`
- **BREAKING (UI only)**: Refactor the top-level `Transcribe` entry points into a `Subtitle` parent:
  - `MusicHeaderV2`, `TvShowHeaderV2`, `MovieHeaderV2`: replace the single **Transcribe** button with a **Subtitle** button that opens a `DropdownMenu` containing `Transcribe` and `Translate`.
  - `MusicFileTable` row context menu: replace the flat **Transcribe** item with a **Subtitle** submenu (`ContextMenuSub` / `ContextMenuSubTrigger` / `ContextMenuSubContent`) containing `Transcribe`, `Stop transcribe` (when running), `Translate`, and `Stop translate` (when running).
  - i18n: existing `mediaPlayer.trackContextMenu.transcribe` keys remain; add `mediaPlayer.trackContextMenu.subtitle`, `.translate`, `.translateStop`, plus dialog and toast strings under `subtitleTranslationDialog.*`.
- Wire `Translate` action in `TvShowPanel`, `MoviePanel`, and `MusicPanel`:
  - The action opens `SubtitleTranslationDialog`, populated with subtitle files derived from `MediaMetadata.mediaFiles[*].subtitleFilePaths` (TV / movie) or from sibling `.srt` / `.ass` files (music, when available); rows whose source media has no subtitle file are listed disabled with a hint.
  - On confirm, one `translate` background job is created per selected subtitle file (sequential queue semantics consistent with transcribe).
- `MusicFileTable` row-level status icon: extend the row state machine so a track that has a `running` / `failed` translate job shows the same kind of inline icon used today for transcribe (`running` spinner, `failed` icon), but distinct from the transcribe indicator (different icon and tooltip).
- Gating: the `Subtitle > Translate` menu item is enabled only when VideoCaptioner discovery reports available (Tencent ASR is **not** a translation backend). `Subtitle > Transcribe` keeps its current `VideoCaptioner OR Tencent ASR` gating. The parent `Subtitle` entry is enabled when **at least one** child is enabled.

## Capabilities

### New Capabilities
- `subtitle-translation-dialog`: New `SubtitleTranslationDialog` UI: source-subtitle row mapping, provider/target-language/LLM option controls, confirmation that enqueues `translate` background jobs.
- `videocaptioner-translate-api`: New `/api/videocaptioner/translate` HTTP endpoint and `translateSubtitleWithVideoCaptioner` CLI helper that invoke `videocaptioner subtitle` with translator/target-language and optional LLM flags, returning success/failure outcome.
- `translate-background-job`: New `translate` job type persisted in the `DownloadTaskDatabase/jobs` IndexedDB store, service-worker `translate:*` lifecycle, `useTranslateManager` hook, and `IndexedDbObserver` mapping; reuses the shared queue / autoStart semantics already used by `transcribe`.
- `panel-subtitle-menu`: New `Subtitle` parent in panel headers and row context menus (`TvShowPanel`, `MoviePanel`, `MusicPanel` / `MusicFileTable`) grouping `Transcribe` and `Translate` actions, with per-child gating (VideoCaptioner / Tencent ASR availability).
- `music-panel-translate-status`: New `MusicFileTable` row-level translate-status icon driven by `useTranslateManager`, mirroring the existing transcribe-status indicator but visually distinct.

### Modified Capabilities
- `music-panel-transcribe`: The `Transcribe` entry points on `MusicHeaderV2` and `MusicFileTable` context menu move under a `Subtitle` parent (button + dropdown / submenu). Existing dialog-opening, selection-mapping, and gating behavior is preserved; only the menu structure changes.
- `tv-movie-panel-transcribe`: The `Transcribe` controls on the TV show / movie panel headers move under a `Subtitle` parent (button + dropdown). Existing dialog-opening and gating behavior is preserved.
- `videocaptioner-integration`: Add an additional **translation command trigger** requirement (parallel to the existing transcription command trigger): API for `videocaptioner subtitle <file>` with `translator`, `targetLanguage`, optional LLM credentials, optional `reflect`. The gating requirement is widened so that VideoCaptioner availability enables both `Subtitle > Transcribe` (with the existing Tencent fallback) and `Subtitle > Translate` (VideoCaptioner only).
- `transcribe-ui-feedback`: Extend the shared background-job lifecycle / toast contract so that `translate` jobs follow the same pending → running → succeeded/failed/stopped semantics, with sequential execution and start/completion toasts.

## Impact

- **Affected code**:
  - `apps/ui/src/components/dialogs/` — new `SubtitleTranslationDialog.tsx`, `UISubtitleTranslationDialog.tsx`, types in `types.ts`, export from `index.ts`.
  - `apps/ui/src/components/MusicHeaderV2.tsx`, `TvShowHeaderV2.tsx`, `MovieHeaderV2.tsx` — replace `Transcribe` button with `Subtitle` dropdown.
  - `apps/ui/src/components/MusicFileTable.tsx` — replace flat transcribe item with `Subtitle` `ContextMenuSub`; add translate-status badge/tooltip.
  - `apps/ui/src/components/MusicPanel.tsx`, `TvShowPanel.tsx`, `MoviePanel.tsx` — wire `Translate` callbacks, instantiate `SubtitleTranslationDialog`, consume `useTranslateManager`.
  - `apps/ui/src/types/background-jobs.ts` — add `TranslateBackgroundJob` / `TranslateBackgroundJobData` / `isTranslateBackgroundJob`.
  - `apps/ui/src/lib/translateJobFactory.ts` (new), `downloadTaskDb.ts` (add `saveTranslateJob`).
  - `apps/ui/src/hooks/useTranslateManager.ts` (new), `useJobManager.ts` (extend `jobType`/`messagePrefix` union).
  - `apps/ui/src/components/IndexedDbObserver.tsx` — map `type=translate` to `BackgroundJob`.
  - `apps/ui/public/download-service-worker.js` — add `startTranslate`/`stopTranslate`/`removeTranslate` and message routing.
  - `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/components.json` — `subtitle`, `translate`, `translateStop`, dialog labels.
  - `apps/cli/src/route/videocaptioner/Translate.ts` (new) + register in router.
  - `apps/cli/src/utils/VideoCaptioner.ts` — add `translateSubtitleWithVideoCaptioner` and supporting constants (`VIDEOCAPTIONER_TRANSLATORS`, `VIDEOCAPTIONER_SUBTITLE_LAYOUTS`).
- **APIs**: New `POST /api/videocaptioner/translate`. No changes to `/api/videocaptioner/transcribe` or `/api/tencent-asr/transcribe`.
- **Dependencies**: No new npm packages. Relies on the same VideoCaptioner executable discovered today (`discoverVideoCaptioner`).
- **Data**: Reuses existing `DownloadTaskDatabase/jobs` IndexedDB store — no schema version bump; only a new `type` value (`translate`).
- **Out of scope**: Not adding `videocaptioner process` (full pipeline) or `videocaptioner synthesize` (burning subtitles into video). Not adding non-VideoCaptioner translation providers (e.g. DeepL, Tencent translation). Not changing the existing transcribe APIs or job semantics.
