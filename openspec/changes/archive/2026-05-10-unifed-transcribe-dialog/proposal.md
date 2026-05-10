## Why

Music panel transcription today bypasses **`TranscribeDialog`** and calls **`transcribeTrackWithFeedback`** / **`transcribeTracksWithFeedback`** directly, while TV and movie flows use the shared dialog (ASR choice, row selection, confirm). That split duplicates behavior and drifts UX. Unifying music on **`TranscribeDialog`** aligns entry points, feedback, and the transcribe pipeline with **`TvShowHeaderV2`** / movie headers.

## What Changes

- **Music panel header**: **Transcribe** opens **`TranscribeDialog`** (same pattern as TV show header), listing eligible music files as rows and using the same confirm → job pipeline as TV/movie dialog confirmations.
- **Music file context menu**: **Transcribe** opens **`TranscribeDialog`** with table selection reset so only the right-clicked track is selected in the dialog (other rows unchecked), avoiding accidental batch transcribe from stale multi-select.
- **Remove** direct music-only transcribe invocation from header batch and context menu in favor of dialog confirmation (implementation detail in **design**).
- **Tests**: Update **`MusicPanel`**, **`MusicFileTable`**, and transcribe-related tests to expect dialog-driven flows where applicable.

## Capabilities

### New Capabilities

- `music-panel-transcribe`: Transcribe entry points for **`MusicPanel`** via **`TranscribeDialog`**: header **Transcribe** when metadata/files are available, context-menu **Transcribe** with selection semantics for the targeted track, row population from music file list, and **VideoCaptioner** availability gating consistent with TV/movie panels.

### Modified Capabilities

- `transcribe-ui-feedback`: Update **MusicPanel**-specific requirements and scenarios so transcription is triggered after **`TranscribeDialog`** confirmation (header and context menu), not on raw menu/header click; keep shared background job and toast semantics; clarify context-menu disabled/enabled behavior relative to opening the dialog.

## Impact

- **Primary**: `apps/ui/src/components/MusicPanel.tsx`, `MusicHeaderV2.tsx`, `MusicFileTable.tsx`, `apps/ui/src/components/dialogs/TranscribeDialog.tsx` (or props/state for initial selection and file list source).
- **Reference**: `TvShowHeaderV2.tsx` and existing TV/movie **`TranscribeDialog`** wiring.
- **Libraries**: `apps/ui/src/lib/transcribeFeedback.ts` — likely reused after dialog confirm rather than from raw music actions.
- **Tests**: `MusicPanel.*.test.tsx`, `MusicFileTable.test.tsx`, and any e2e touching music transcribe.
- **APIs**: No new backend endpoints expected; existing **`/api/videocaptioner/transcribe`** path remains.
