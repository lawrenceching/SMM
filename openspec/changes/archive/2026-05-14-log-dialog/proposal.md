## Why

Subtitle-related background jobs (transcribe, translate, synthesize, process) invoke `videocaptioner` through `runWhitelistedCommandSync`, which already writes a per-run command log under `<LOG_DIR>/commands/<executionId>/main.log`, but the UI never receives `executionId` and has no way to open that log from the Status Bar **Background jobs** list. Operators must guess failures from status alone. Surfacing read-only logs from the same list closes the observability gap without a new logging subsystem.

## What Changes

- Extend CLI so each `runWhitelistedCommandSync` invocation returns (and videocaptioner JSON routes emit) `executionId` and `logRelativePath` alongside existing `success` / `error` outcomes, including on HTTP 400 paths where a log was still created.
- Add a read-only HTTP API to fetch command log content (or parsed segments) by `executionId`, with strict UUID validation and path confinement under the existing log root.
- Persist `executionId` (and optional `logRelativePath`) into subtitle job records in IndexedDB when the service worker completes the videocaptioner fetch, and map them through `IndexedDbObserver` into `backgroundJobsStore`.
- Add **Log** affordance on each subtitle-type row in `BackgroundJobsPopover`; open a new **LogDialog** registered via `DialogProvider` / `useDialogs`, loading log text from the new API with sensible loading, empty, truncation, and retry behavior.
- Align UX with the existing `ExecuteCmdDialog` log presentation (stream kinds, monospace) without refactoring that dialog.
- Document the public API in `docs/api/index.md` (operational follow-up outside this change’s code deliverable can reference the design doc).

## Capabilities

### New Capabilities

- `command-log-read-api`: Read-only `GET /api/command-log/:executionId` (and optional query parameters for range / format) that returns `main.log` content from `<LOG_DIR>/commands/<uuid>/`, rejects invalid IDs and path traversal, and enforces a maximum response size with explicit truncation signaling.
- `subtitle-job-command-log-correlation`: End-to-end correlation of `executionId` / `logRelativePath` from `runWhitelistedCommandSync` through `/api/videocaptioner/*` responses into the service worker’s job `data`, `IndexedDbObserver` mapping, and typed `BackgroundJob` payloads for `transcribe`, `translate`, `synthesize`, and `process` job types only.
- `background-jobs-log-dialog`: Status Bar background-jobs list exposes a log action for subtitle jobs that have an `executionId`; `LogDialog` is opened through the shared dialog provider, fetches log content via TanStack Query, supports refresh and copy helpers, and uses i18n strings consistent with existing dialog patterns.

### Modified Capabilities

- (none) — existing published specs for individual job types remain the source of truth for lifecycle; this change adds orthogonal correlation and UI affordances without redefining queue semantics, filters, or success criteria.

## Impact

- **CLI**: `executeCmd.ts` (`runWhitelistedCommandSync` return shape), `VideoCaptioner.ts` result type if shared, each `apps/cli/src/route/videocaptioner/*.ts` handler that calls `runWhitelistedCommandSync`, new route module + registration in the app router, tests.
- **UI**: `download-service-worker.js` (four start handlers), `background-jobs.ts` types, `IndexedDbObserver.tsx`, `BackgroundJobsPopover.tsx`, `dialog-provider.tsx`, new `LogDialog` / API client hook, locale files under `public/locales/*/dialogs.json` (or `components.json` per existing convention).
- **Docs**: `docs/api/index.md` entry; implementation follows `docs/design/log-dialog-design.md`.
- **Out of scope for this change**: `download-video` / yt-dlp log buttons; changing `POST /api/executeCmd` streaming contract; server-side log retention policy.
