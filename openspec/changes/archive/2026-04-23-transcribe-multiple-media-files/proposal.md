## Why

`MusicPanel` currently handles transcription as a single-file action, which blocks users from efficiently processing batches of media. With multi-select mode already available, users now need batch transcription that queues selected files and executes them reliably one-by-one.

## What Changes

- Allow `MusicPanel` to submit multiple selected audio/video files to transcription from a single `Transcribe` click while in select mode.
- Create a background job entry for each selected file immediately in `pending` state.
- Execute queued transcription jobs sequentially (single worker), promoting only one pending job to running at a time.
- Automatically start the next pending job after the current job finishes, regardless of success or failure.
- Keep per-file completion outcomes in background jobs so users can see mixed success/failure across the batch.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `transcribe-ui-feedback`: Extend transcription lifecycle requirements to support multi-file queue creation, pending state semantics, and strict sequential execution.

## Impact

- `MusicPanel` transcribe action flow and selection-mode action handling.
- Background jobs state management (job creation, pending/running transitions, completion chaining).
- Transcribe UI feedback behavior and related tests for queue ordering and mixed outcomes.
