## Context

SMM already ships a complete **Transcribe** flow that the **Translate** feature can closely mirror:

- **Dialog**: `TranscribeDialog` enqueues jobs only; it builds `TranscribeBackgroundJob` via `buildTranscribeJob` and persists via `saveTranscribeJob` → IndexedDB store `DownloadTaskDatabase/jobs`.
- **Orchestration**: `useTranscribeManager` wraps the generic `useJobManager`, which handles IndexedDB polling, `indexed-updated` events, auto-starting the next `pending` job, and routing service-worker messages (`transcribe:started/succeeded/failed/stopped`).
- **Execution**: `download-service-worker.js` listens for `transcribe:start`, fetches `/api/videocaptioner/transcribe` or `/api/tencent-asr/transcribe`, then broadcasts the terminal state back to clients.
- **Row UI**: `MusicPanel` derives per-track `transcribeStatus` (`running`/`failed`) from `useTranscribeManager.transcribingPaths` + `transcribeFailedPaths` and passes it to `MusicFileTable`, which renders a spinner / failure badge in the title cell and a row-level **Stop** action.
- **CLI integration**: `apps/cli/src/utils/VideoCaptioner.ts` discovers the executable (`discoverVideoCaptioner`) and exposes `transcribeWithVideoCaptioner`, called from `apps/cli/src/route/videocaptioner/Transcribe.ts`.
- **Panel entry points**:
  - `TvShowHeaderV2` / `MovieHeaderV2` expose a single **Transcribe** `Button`.
  - `MusicHeaderV2` exposes a **Transcribe** `Button` (only opens the dialog; does not enqueue directly).
  - `MusicFileTable` row context menu has a flat **Transcribe** `ContextMenuItem`.

VideoCaptioner's `subtitle` CLI subcommand performs the translation in a single command:

```
videocaptioner subtitle <subtitle-file> \
  --translator <bing|google|llm> \
  --target-language <BCP47> \
  [--reflect] [--no-optimize] [--no-split] \
  [--api-key …] [--api-base …] [--model …] \
  [--layout target-above|source-above|target-only|source-only]
```

The translated subtitle is written next to the input file by default. Source-language detection is implicit (read from the input file).

Stakeholders: end users with multilingual libraries; AGENTS (UI panels, CLI route, service worker, IndexedDB).

## Goals / Non-Goals

**Goals:**

- Add subtitle translation as a first-class background job, fully reusing the transcribe pipeline (IndexedDB store, service-worker abstraction, `useJobManager`).
- Keep the panel UI surface compact by collapsing **Transcribe** + **Translate** under a single **Subtitle** entry in headers and row context menus across TV/Movie/Music panels.
- Reuse `videocaptioner` executable discovery — no new external dependencies.
- Preserve current transcribe behavior (gating, default selection, sequential queue, toasts) unchanged.
- Provide row-level visual feedback in `MusicFileTable` for in-flight translate jobs, distinct from transcribe.

**Non-Goals:**

- No backend translation provider other than VideoCaptioner (no DeepL, Tencent translation, in-app LLM call).
- No `videocaptioner process` / `synthesize` integration.
- No batch translation of folders without a subtitle file (we list, but disable, rows missing a source `.srt` / `.ass`).
- No changes to existing transcribe IndexedDB records or transcribe API.
- No IndexedDB schema version bump.

## Decisions

### D1. Reuse the existing job pipeline instead of building a parallel one

Adopt the same `IndexedDB → useJobManager → service-worker → fetch` shape used by `transcribe`. The generic `useJobManager` already accepts `jobType` and `messagePrefix` parameters; we extend its discriminated union and add a `messagePrefix: 'translate'`.

**Alternatives considered:**

- *Run translation directly from the dialog `onConfirm` with `await fetch(...)`*. Rejected — would lose persistence across reloads, lose toast/queue parity with transcribe, and would bypass the existing observer that powers global `BackgroundJobs`.
- *Multiplex translate inside the existing `transcribe` job type with a subkind flag*. Rejected — couples two distinct UX flows, complicates the row-status mapping in `MusicFileTable` (a track can have both a running transcribe and a running translate), and forces every `useTranscribeManager` consumer to branch.

**Implication:** Introduce `type: 'translate'` rows in the same `jobs` object store with their own `data` shape. `IndexedDbObserver` and `useJobManager` are extended to recognize the new type.

### D2. Single `Subtitle` entry point with provider-specific submenus

In all three panel headers, replace the standalone `Transcribe` `Button` with a `Subtitle` `Button` that opens a `DropdownMenu` containing `Transcribe` and `Translate`. In `MusicFileTable` row context menu, replace the flat `Transcribe` item with a `ContextMenuSub` (`Subtitle` trigger) containing `Transcribe`, `Translate`, and their respective `Stop …` items (rendered only when a matching job is running for the row).

**Alternatives considered:**

- *Keep `Transcribe` flat and add a sibling `Translate` button/item*. Rejected — clutters the header for media types where users may rarely use one of the two; doubles the row-context-menu height; doesn't scale to future subtitle ops (synthesize, optimize).
- *Use a separate top-level "Subtitle" tab/section*. Rejected — overkill for two actions; conflicts with the existing single-panel layout and would require restructuring `TvShowPanel`/`MoviePanel`.

**Implication:** Per-child gating logic moves from a per-button `disabled` into the dropdown/submenu items. The parent `Subtitle` control is `disabled` only when both children would be disabled (no transcribe/translate path available **and** no subtitle source files).

### D3. VideoCaptioner is the only translation backend in v1

Tencent ASR is a transcription provider only; it does not perform translation. The `SubtitleTranslationDialog` therefore has no "Provider" selector — it always uses `videocaptioner subtitle`. The dialog's primary selector is **Translator** (`bing` / `google` / `llm`), defaulting to `bing` (free, no credentials required).

**Alternatives considered:**

- *Mirror `TranscribeDialog`'s `Provider` selector for symmetry*. Rejected as premature abstraction — adds an empty selector that confuses users.

**Implication:** The `Translate` menu item is gated solely by `useVideoCaptionerStatus().isAvailable`. The dialog's `llm` translator selection reveals additional **API Key**, **API Base**, **Model**, and **Reflect** inputs; confirm is blocked when `llm` is selected and credentials are missing (analogous to the Tencent-credentials validation in `TranscribeDialog`).

### D4. Source subtitle row mapping per panel

- **TV / Movie panels**: rows are derived from `MediaMetadata.mediaFiles`. For each `MediaFileMetadata`, one dialog row is built per entry in `subtitleFilePaths`. When `subtitleFilePaths` is empty / undefined, the media file is *still listed* but the row is disabled with a hint ("No subtitle file found. Run Transcribe first."), so users discover the dependency.
- **Music panel**: rows are derived from `MusicFileRow`s and follow the same approach: sibling subtitle files are detected by replacing the audio extension with `.srt` / `.ass` (and `getMediaTags`-style detection if available). Tracks without a sibling subtitle are listed but disabled.

**Alternatives considered:**

- *Hide rows without a source subtitle entirely*. Rejected — silently hiding rows makes it look like a bug ("why isn't this track here?").
- *Implicit auto-transcribe before translate*. Rejected — opaque behavior; user should make the call.

**Implication:** `subtitleTranslationDialogRowsFromMediaFiles` / `…FromMusicFileRows` produce rows with an explicit `eligible: boolean` (plus a localized `disabledReason`). `UISubtitleTranslationDialog` renders disabled rows greyed out and excludes them from default selection.

### D5. Job → file path semantics

`TranslateBackgroundJobData` stores **the source subtitle file path**, not the media file path:

```ts
interface TranslateBackgroundJobData {
  folder: string;                  // platform path for manager filter
  subtitlePath: string;            // POSIX absolute (UI row matching)
  subtitlePathPlatform: string;    // platform path for API request body
  /** Associated media file path (for row-status mapping in MusicFileTable) */
  mediaPath?: string;
  mediaPathPlatform?: string;
  title: string;
  translator: 'bing' | 'google' | 'llm';
  targetLanguage: string;          // BCP-47, e.g. 'zh-Hans'
  reflect?: boolean;               // only meaningful when translator === 'llm'
  llm?: { apiKey: string; apiBase?: string; model?: string };
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only';
}
```

`mediaPath` is duplicated so that `useTranslateManager` can expose `translatingPaths: Set<string>` keyed by **media file path**, which is what `MusicFileTable` rows match against. (When a track has multiple subtitles being translated, the union of media paths still maps to a single `running` row state.)

### D6. Status icon strategy in `MusicFileTable`

Add a second status indicator to `MusicFileRow` (alongside `transcribeStatus`):

```ts
translateStatus?: 'running' | 'failed'
```

Render order in the title cell: transcribe spinner/failure first, then translate spinner/failure. Each indicator gets a distinct icon (`Captions` for transcribe is already in use; `Languages` / `Globe` from `lucide-react` for translate) and a distinct tooltip key. The row state machine remains additive — both states can coexist for the same track.

### D7. Service-worker translate command

Add three handlers parallel to the transcribe ones:

- `translate:start` → `startTranslate(jobId)`: load job, mark `running`, broadcast `translate:started`, `POST /api/videocaptioner/translate` with `{ subtitlePath: data.subtitlePathPlatform, translator, targetLanguage, reflect?, llm?, layout? }`, on success → `succeeded`, on error → `failed`, on abort → `stopped`.
- `translate:stop` → `stopTranslate(jobId)`: abort controller, mark `stopped`, broadcast `translate:stopped`.
- `translate:remove` → `removeTranslate(jobId)`: abort + delete DB row + broadcast `translate:removed`.

Reuse the existing `notifyClients` / heartbeat / abort-controller helpers. Heartbeat event name: `translate:heartbeat`.

### D8. CLI helper shape

```ts
export const VIDEOCAPTIONER_TRANSLATORS = ['bing', 'google', 'llm'] as const
export type VideoCaptionerTranslator = typeof VIDEOCAPTIONER_TRANSLATORS[number]

export const VIDEOCAPTIONER_SUBTITLE_LAYOUTS =
  ['target-above', 'source-above', 'target-only', 'source-only'] as const

export interface TranslateSubtitleCliOptions {
  translator: VideoCaptionerTranslator
  targetLanguage: string
  reflect?: boolean
  layout?: typeof VIDEOCAPTIONER_SUBTITLE_LAYOUTS[number]
  llm?: { apiKey: string; apiBase?: string; model?: string }
}

export async function translateSubtitleWithVideoCaptioner(
  subtitlePath: string,
  options: TranslateSubtitleCliOptions,
): Promise<{ success?: boolean; error?: string }>
```

CLI argv: `videocaptioner subtitle <subtitlePath> --translator <…> --target-language <…> [--reflect] [--layout …]` plus `--no-optimize --no-split` (we explicitly skip those steps because optimization/segmentation are out of scope and depend on LLM credentials).

For LLM credentials, prefer command-line flags (`--api-key`, `--api-base`, `--model`) over environment variables so the call is stateless and doesn't leak into other concurrent invocations.

Timeout: same `10 * 60 * 1000` ms ceiling as transcribe.

### D9. i18n key namespace

All new strings go under `components.json` (the existing namespace used by `MusicHeaderV2`):

- `mediaPlayer.trackContextMenu.subtitle`
- `mediaPlayer.trackContextMenu.translate`
- `mediaPlayer.trackContextMenu.translateStop`
- `mediaPlayer.translateFailedTooltip`
- `subtitleTranslationDialog.title` / `description` / `translator` / `targetLanguage` / `reflect` / `apiKey` / `apiBase` / `model` / `layout` / `confirm` / `cancel` / `noSubtitleFile`
- `subtitleTranslationDialog.toastStart` / `toastSucceeded` / `toastFailed`

All four locales (`en`, `zh-CN`, `zh-HK`, `zh-TW`) get keys; until human translation lands, non-en values can mirror the en string or use `defaultValue` in the call site.

## Risks / Trade-offs

- **Risk**: VideoCaptioner `subtitle --translator llm` requires API credentials; users may try it without setting them and see a generic CLI error → **Mitigation**: dialog disables Confirm when `translator === 'llm'` and API key is empty; surface backend stderr in the failed-job toast (truncated to 500 chars like the transcribe helper already does).
- **Risk**: Output file name collision — `videocaptioner subtitle` rewrites or co-locates output near the input → **Mitigation**: leave the output path to VideoCaptioner defaults in v1; document this in the user-facing dialog description. Refining the output naming policy is out of scope.
- **Risk**: Mapping `translatingPaths` by **media file** path means two subtitle translations for the same media file collapse into one row state. → **Mitigation**: acceptable in v1 (rare edge case); when multiple translate jobs target the same media file, the UI badge stays `running` until all are terminal — semantically correct.
- **Risk**: `subtitleFilePaths` may be missing on existing libraries that haven't been re-scanned → **Mitigation**: the disabled-row-with-hint UX (D4) makes the cause visible to the user. Re-scanning is already handled by the existing media-metadata pipeline.
- **Trade-off**: We add a second visual indicator to the music row title cell. Two simultaneous indicators per row could feel busy. → **Mitigation**: keep indicators small (`size-3.5`), separate by 4px, and rely on tooltips for disambiguation.
- **Trade-off**: Header dropdown adds one click compared to the previous flat button. → **Mitigation**: the dropdown groups related actions and is consistent across all three panels; the menu is also the natural place to surface "Translate" gating disabled-state hints.

## Migration Plan

- **Frontend**: pure additive — new components, hooks, types, and a service-worker case. The header refactor changes the rendered button label/icon, but the underlying `onTranscribeClick` callback contract is preserved; no consumer beyond the panels themselves needs to change.
- **Service worker**: the file is versioned by Vite asset hashing; on next deploy, existing clients pick up the new handler on `activate`. Old service workers without `translate:*` handlers simply ignore the message — but the matching client will never post `translate:*` to an old SW because the same build ships both pieces. No rollback hazard.
- **IndexedDB**: no schema version bump (still `DB_VERSION = 1`). Existing `transcribe` and `download-video` rows are untouched. New `type=translate` rows coexist; `getJobsByTypeAndFolder` already filters by `type`.
- **CLI route**: additive — new `/api/videocaptioner/translate` endpoint. No changes to existing transcribe routes.
- **Rollback**: revert PR; existing `transcribe` flow is unaffected (we never touched its files in a breaking way). Any in-flight `translate` rows in users' IndexedDB are inert in the rollback build (no handler picks them up); a follow-up cleanup is unnecessary because they'll age out of `getJobsByTypeAndFolder`'s 1-hour window.

## Open Questions

- Should `Subtitle > Translate` in the header default-select all eligible subtitle files (analogous to current transcribe-header default), or open with an empty selection so the user explicitly picks? **Tentative decision**: match transcribe behavior — default-select all eligible rows (or the existing multi-select tracks when non-empty in the music panel).
- Should the dialog persist the last-used `translator` / `targetLanguage` via `localStorage` (analogous to `transcribe.autoStart`)? **Tentative decision**: yes, keys `subtitleTranslation.translator` and `subtitleTranslation.targetLanguage`.
- Should we add a `translate` MCP tool symmetric to the transcribe tool? **Tentative decision**: out of scope for v1; can be added in a follow-up change.
