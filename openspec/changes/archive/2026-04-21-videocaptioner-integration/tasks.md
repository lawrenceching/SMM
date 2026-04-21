## 1. Backend VideoCaptioner APIs

- [x] 1.1 Add VideoCaptioner discovery endpoint/handler in `apps/cli` that performs executable presence checks only and returns availability metadata needed by UI gating.
- [x] 1.2 Add transcription trigger endpoint/handler in `apps/cli` that accepts target media file input, starts VideoCaptioner asynchronously, and applies fixed v1 defaults.
- [x] 1.3 Reuse existing command execution utilities and map command-start errors to stable API error responses.

## 2. Frontend Integration

- [x] 2.1 Add/extend `apps/ui` API client methods for VideoCaptioner discovery and transcription trigger calls.
- [x] 2.2 Run discovery during startup initialization and store the availability result in UI state for menu rendering.
- [x] 2.3 Wire `Transcribe` context-menu action in `MusicPanel` for supported media entries and bind enabled/disabled state to discovery availability.
- [x] 2.4 Add success/failure toast feedback for transcription command submission.

## 3. Validation and Tests

- [x] 3.1 Add or update backend tests for discovery success/failure and transcription command trigger success/failure paths.
- [x] 3.2 Add or update UI tests for `MusicPanel` `Transcribe` menu enable/disable behavior based on discovery result.
- [x] 3.3 Add or update UI tests for transcription action dispatch and user feedback behavior.
- [x] 3.4 Run targeted UI/CLI test suites and fix regressions before implementation handoff.
