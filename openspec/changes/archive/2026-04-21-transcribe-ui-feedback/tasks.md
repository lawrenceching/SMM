## 1. Backend completion semantics

- [x] 1.1 Refactor `apps/cli/src/utils/VideoCaptioner.ts` transcribe execution to wait for process completion and map exit status to success/error response.
- [x] 1.2 Update `apps/cli/src/route/videocaptioner/Transcribe.ts` handling so endpoint returns completion result (not start acknowledgment).
- [x] 1.3 Add/adjust backend tests for success exit, non-zero exit, spawn/runtime error, and timeout behavior.

## 2. UI transcribe feedback lifecycle

- [x] 2.1 Extend `apps/ui/src/stores/backgroundJobsStore.ts` with transcribe job creation/update flow (running -> succeeded/failed).
- [x] 2.2 Update `apps/ui/src/components/MusicPanel.tsx` transcribe handler to show start toast, create running job, await API, then show completion toast.
- [x] 2.3 Wire API result/error mapping in `MusicPanel` to update the matching background job status to succeeded/failed.

## 3. Validation and regression checks

- [x] 3.1 Add/update UI tests for toast sequence (`start` then `success`/`failure`) and background job transitions.
- [x] 3.2 Confirm existing transcribe availability gating remains unchanged in `MusicFileTable`/discover flow.
- [x] 3.3 Run targeted test suites for CLI and UI transcribe-related files and fix regressions.
