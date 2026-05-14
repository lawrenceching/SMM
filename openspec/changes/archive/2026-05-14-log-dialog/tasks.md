## 1. CLI — correlation and read API

- [x] 1.1 Extend `runWhitelistedCommandSync` / shared result type to return `executionId` and `logRelativePath` whenever `createCommandExecutionLogWriter` was used; add/adjust unit tests in `executeCmd` / `commandExecutionLog` area.
- [x] 1.2 Update `POST /api/videocaptioner/transcribe`, `translate`, `synthesize`, and `process` handlers to include correlation fields on both success and error JSON bodies; extend route tests.
- [x] 1.3 Implement `GET /api/command-log/:executionId` (validation, path confinement, size cap, optional `format` / range query params) and register it in the CLI app router; add focused tests including traversal and 404 cases.
- [x] 1.4 Append the new endpoint to `docs/api/index.md` with a one-line summary and link to full doc if created.

## 2. UI types and persistence

- [x] 2.1 Add optional `executionId` and `logRelativePath` to `TranscribeBackgroundJobData`, `TranslateBackgroundJobData`, `SynthesizeBackgroundJobData`, and `ProcessBackgroundJobData` in `apps/ui/src/types/background-jobs.ts`.
- [x] 2.2 Update `download-service-worker.js` (`startTranscribe`, `startTranslate`, `startSynthesize`, `startProcess`) to merge API correlation fields into `job.data` and persist with `dbPutJob` before terminal status transitions.
- [x] 2.3 Extend `IndexedDbObserver` mapping so the new fields flow into `backgroundJobsStore` jobs.

## 3. LogDialog and dialog provider

- [x] 3.1 Add API helper (e.g. `apps/ui/src/api/commandLog.ts`) using `withDevApiUrl` / fetch patterns consistent with `executeCmd.ts`.
- [x] 3.2 Implement `LogDialog` + optional presentational shell (loading, truncation banner, segment vs raw toggle) and wire TanStack Query for fetch + refresh.
- [x] 3.3 Register dialog state and render target in `dialog-provider.tsx`; extend `useDialogs` context type; export from `components/dialogs/index.ts` if needed.
- [x] 3.4 Add `BackgroundJobsPopover` log affordance with visibility rules and `openLogDialog` integration; ensure layout works alongside abort control.

## 4. i18n, docs, and verification

- [x] 4.1 Add/translate keys in `public/locales/{en,zh-CN,zh-HK,zh-TW}/` for log button, dialog title, empty/error/truncation copy, and actions.
- [x] 4.2 Add UI tests for popover visibility and dialog open + happy-path mock; add CLI tests already covered in 1.x if gaps remain.
- [ ] 4.3 Manual smoke: run a short `videocaptioner` job, confirm `executionId` appears in IDB, open log from Status Bar, verify content matches `main.log` on disk.
