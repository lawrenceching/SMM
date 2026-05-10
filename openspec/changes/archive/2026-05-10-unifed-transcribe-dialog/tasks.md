## 1. Music transcribe dialog rows

- [x] 1.1 Add `transcribeDialogRowsFromMusicFileRows` (or equivalent) in `apps/ui/src/lib/transcribeDialogRows.ts`, mapping `MusicFileRow[]` with `path` to `TranscribeDialogRow[]` using POSIX absolute paths as `id`, optional relative `displayPath` vs `mediaFolderPath`, and `title` from track metadata.
- [x] 1.2 Add unit tests for the music row helper (skip rows without path; stable ids; display path behavior when folder set).

## 2. MusicPanel dialog state and wiring

- [x] 2.1 Add `isTranscribeOpen` and `transcribeDialogDefaultSelectedIds` (or equivalent) state in `apps/ui/src/components/MusicPanel.tsx`; memoize dialog rows from current table/track list via the new helper.
- [x] 2.2 Render `TranscribeDialog` at `MusicPanel` root with `rows`, `isOpen`, `onClose`, and `defaultSelectedIds` when opening from header or context menu; reset default-selection state on close.
- [x] 2.3 Replace header `onTranscribeClick`: validate at least one eligible row (toast if none); compute `defaultSelectedIds` from current multi-select when any selected row has a path, otherwise omit `defaultSelectedIds` so all rows default selected per design.
- [x] 2.4 Replace `onTrackTranscribe`: clear `selectedTrackIds` (table multi-select), set `defaultSelectedIds` to the context-menu track’s POSIX path id only, then open dialog.
- [x] 2.5 Remove direct calls to `transcribeTrackWithFeedback` / `transcribeTracksWithFeedback` from `MusicPanel`; drop `handleBatchTranscribe` / `handleTrackTranscribe` as wired today and remove `isBatchTranscribing` (or equivalent) if only used for the old batch path.
- [x] 2.6 Align `MusicHeaderV2` props if needed (e.g. remove misleading `isTranscribing` spinner tied only to pre-dialog batch work).

## 3. Tests and verification

- [x] 3.1 Update `MusicPanel.test.tsx` / `MusicPanel.transcribe.test.tsx` for dialog-driven flows (mock or assert dialog open and confirm path if applicable).
- [x] 3.2 Update `MusicFileTable.test.tsx` transcribe tests so enabled context menu asserts parent callback / dialog-open behavior instead of immediate transcribe pipeline where specs require dialog first.
- [x] 3.3 Run `pnpm test:ui` (or targeted test files) and fix regressions.
