## Context

**TV / movie**: `TvShowPanel` and `MoviePanel` render `TranscribeDialog` with rows from `transcribeDialogRowsFromMediaFiles(mediaMetadata)`. Header **Transcribe** toggles dialog open state; confirmation is handled inside `TranscribeDialog`, which calls `transcribeTracksWithFeedback` with ASR options when enabled (`apps/ui/src/components/dialogs/TranscribeDialog.tsx`).

**Music**: `MusicPanel` wires header **Transcribe** to `handleBatchTranscribe` and context menu to `handleTrackTranscribe`, both calling `transcribeFeedback` helpers directly—no dialog, no ASR picker in the music path.

**Existing hook**: `UITranscribeDialog` / types already support **`defaultSelectedIds`**; when omitted, all rows start selected (`apps/ui/src/components/dialogs/types.ts`). Row **`id`** is used for selection and must stay stable for the open session.

## Goals / Non-Goals

**Goals:**

- Open the same **`TranscribeDialog`** component from **MusicPanel** for header and context-menu transcribe actions.
- After **Confirm**, reuse the existing smart dialog pipeline (`TranscribeDialog` → `transcribeTracksWithFeedback` + background jobs + ASR when feature flag allows).
- Header flow: show one dialog row per transcribe-eligible track; default checked rows match **current table multi-select** (selected rows only when at least one selected and paths exist); align UX with “pick files then confirm” like TV/movie.
- Context-menu flow: open dialog with **only** the right-clicked track checked; **clear** `MusicFileTable` multi-select state so the table does not keep a stale batch selection.
- Centralize row construction for music (paths, labels, display paths) next to `transcribeDialogRowsFromMediaFiles`.

**Non-Goals:**

- Changing VideoCaptioner HTTP API or CLI contracts.
- Changing TV/movie transcribe behavior or row builders beyond incidental reuse.
- New product requirements for music-only ASR defaults (reuse dialog defaults from existing specs).

## Decisions

### 1. Row builder for music

**Decision**: Add something like `transcribeDialogRowsFromMusicFileRows(rows, mediaFolderPath?)` in `apps/ui/src/lib/transcribeDialogRows.ts` (or a sibling module if imports become circular).

**Details**:

- Input: `MusicFileRow[]` plus optional `mediaFolderPath` for relative **`displayPath`** (same pattern as `displayPathForFile` in existing helper).
- Include only rows with a usable **`path`** (mirror current “no path → toast error” behavior by omitting or filtering—prefer **omit** from dialog list; optionally document if empty list should block opening).
- **`TranscribeDialogRow.id`**: use **POSIX absolute path** string (`Path.posix(...)`) as canonical id, consistent with TV/movie rows (`id: absolutePath` in `transcribeDialogRowsFromMediaFiles`). Enables **`defaultSelectedIds`** to reference paths, not numeric track ids.
- **`title`**: track title (fallback basename like `TranscribeDialog` already does for feedback).

**Alternatives considered**:

- Use numeric **`MusicFileRow.id`** as dialog row id → rejected: harder to align with path-based API and with TV row ids; paths are the stable transcribe key.
- Inline row mapping only in `MusicPanel` → rejected: duplicates relative-path labeling logic already living in `transcribeDialogRows.ts`.

### 2. MusicPanel state for dialog

**Decision**: Mirror TV/movie: local boolean **`isTranscribeOpen`** plus optional **`transcribeDialogDefaultSelectedIds: string[] | undefined`** (or derive last-open intent without persisting across unrelated opens).

**Details**:

- **`TranscribeDialog`** rendered once at `MusicPanel` root (sibling to header/table), same structural pattern as `TvShowPanel`.
- When opening from **header**: set `defaultSelectedIds` from **`selectedRows`** filtered to rows with `path`, mapped to POSIX id strings. If **no** rows selected in multi-select mode, either:
  - **Preferred**: default to **all** eligible row ids (match “omit `defaultSelectedIds`” behavior), or
  - Require selection before opening (stricter; conflicts with TV “all media files listed”). Proposal expects listing eligible files; **preferred** = all selected when selection empty, selected subset when user has checked rows.
- When opening from **context menu**: set `selectedTrackIds` to **`[]`** (or equivalent) **before** or **when** opening dialog; set `defaultSelectedIds` to **`[posixPathOfClickedRow]`** only.
- On **`onClose`**: clear `defaultSelectedIds` / reset intent so the next open does not reuse stale selection unless explicitly set.

**Alternatives considered**:

- Separate dialogs for header vs menu → rejected: duplicates ASR UI and strings.

### 3. Header callback contract

**Decision**: Replace `MusicHeaderV2` **`onTranscribeClick`** implementation so it **opens the dialog** instead of calling `handleBatchTranscribe`. Keep **`isTranscribeAvailable`** / feature + VideoCaptioner gating unchanged.

**Details**:

- Remove or narrow **`isBatchTranscribing`** / **`isTranscribing`** if they only guarded the old fire-and-forget batch; post-dialog, work starts **after** confirm inside `TranscribeDialog` (same as TV). If the header button shows a spinner only during **confirm → first toast**, prefer removing misleading batch state unless UX still needs it.

**Alternatives considered**:

- Keep batch transcribe for header only → rejected by proposal.

### 4. Context menu contract

**Decision**: Change **`onTrackTranscribe`** handler to: normalize selection in parent (`MusicPanel`), open dialog with **`defaultSelectedIds`** for that track’s path id.

**Details**:

- `MusicFileTable` can stay dumb: still calls `onTrackTranscribe(row)`; parent owns dialog + clearing **`selectedTrackIds`**.

**Alternatives considered**:

- Pass “open mode” into table → unnecessary coupling.

### 5. Empty / edge cases

**Decision**:

- If **no** transcribe-eligible rows (no paths): do not open dialog; **`toast.error`** with existing or aligned copy (e.g. “no files to transcribe”).
- Header open when **selection** is non-empty but **no** selected row has a path: fall back to all eligible rows or show error—**preferred**: show error listing that selection has no resolvable files.

Document final choice in implementation if product prefers fallbacks.

## Risks / Trade-offs

- **[Risk] Extra click for users who previously transcribed one menu action** → **Mitigation**: Same as TV/movie; ASR and multi-file review justify the step.
- **[Risk] `defaultSelectedIds` includes ids not in `rows`** → **Mitigation**: `UITranscribeDialog` should tolerate mismatch (verify); only pass ids built from the same row map as `rows`.
- **[Risk] Clearing multi-select on context-menu transcribe surprises users** → **Mitigation**: Matches proposal intent (avoid accidental batch); document in spec scenarios.

## Migration Plan

- Ship as a single frontend change; no migrations or flags required beyond existing **`isTranscribeEnabled`** / VideoCaptioner readiness.
- **Rollback**: revert the PR restoring direct `transcribeFeedback` calls from music header/menu.

## Open Questions

- **Header + empty selection**: Confirm product preference between “default all eligible rows” vs “require at least one selected row” when multi-select mode is on but selection is empty (design above recommends default-all for parity with TV dialog listing all episodes).
