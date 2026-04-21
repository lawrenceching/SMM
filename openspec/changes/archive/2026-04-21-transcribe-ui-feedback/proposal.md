## Why

The current transcribe flow only confirms that the command was started, so users cannot tell whether transcription actually succeeded or failed. Aligning UI feedback with real command completion improves trust and makes background-job status meaningful.

## What Changes

- Change VideoCaptioner transcribe API behavior from fire-and-return to synchronous completion: wait for command exit and return success/failure outcome.
- Update `MusicPanel` transcribe interaction to show a “transcribe started” toast immediately and create a background job record when user triggers transcribe.
- Update UI handling to show completion toast (success or failure) based on API result.
- Update background job lifecycle in store/UI so transcribe jobs move to succeeded/failed state when API returns.
- Add/update tests for synchronous API result mapping, toast behavior, and background job status transitions.

## Capabilities

### New Capabilities
- `transcribe-ui-feedback`: End-to-end transcribe UX feedback with start/completion toasts and background-job state updates based on real command results.

### Modified Capabilities
- `videocaptioner-integration`: Change transcribe request semantics from “started” acknowledgment to command-completion result reporting.

## Impact

- Affected code: `apps/cli` transcribe utility/route process control; `apps/ui/src/components/MusicPanel.tsx`; `apps/ui/src/stores/backgroundJobsStore.ts`; related UI API wrappers/tests.
- APIs: `/api/videocaptioner/transcribe` response timing and semantics change (wait for completion).
- Dependencies/systems: command execution timeout/error handling and user-visible latency during request.
