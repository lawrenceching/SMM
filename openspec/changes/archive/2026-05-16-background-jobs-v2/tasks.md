## 1. Phase 1 — Registry + Orchestrator Infrastructure

- [x] 1.1 Create `apps/ui/src/lib/jobTypeRegistry.ts` with `JobTypeConfig` interface, `JOB_TYPE_REGISTRY` entries for all 5 current types (`download-video`, `transcribe`, `translate`, `synthesize`, `process`), `ALL_JOB_TYPES` constant, and `swEventNames(prefix)` utility
- [x] 1.2 Create `apps/ui/src/components/JobOrchestratorProvider.tsx` with full lifecycle: SW registration + `handleSwReactivate`, IndexedDB ↔ Zustand sync, generic SW message handler (no per-type branches), `tryAutoStart(type, folder)`, `tryAutoStartAll()`, and `window.__jobOrchestrator` bridge
- [x] 1.3 Implement `createJob(job)`, `createJobs(jobs)`, `startJob(id, options)`, `stopJob(id)`, and `removeJob(id)` imperative API inside `JobOrchestratorProvider`
- [x] 1.4 Implement `useFileStatuses(folder, type)` reactive hook inside the provider (registry-driven `extractPath`, `jobIdsByPath`, `primaryJobIdByPath`, running/pending/failed path sets)
- [x] 1.5 Implement `useJobIndicatorState()` reactive hook inside the provider (aggregated counts, `statusVariant`, `isPopoverOpen`/`setPopoverOpen`)
- [x] 1.6 Create `apps/ui/src/hooks/useJobOrchestrator.ts` — React context consumption hook that throws if used outside the provider
- [x] 1.7 Add global TypeScript declaration for `window.__jobOrchestrator` (e.g., in `apps/ui/src/types/global.d.ts`)
- [x] 1.8 Mount `<JobOrchestratorProvider>` in `apps/ui/src/AppV2.tsx` at the app root, above all panels and dialogs
- [x] 1.9 Add `enabled` parameter to `useJobManager.ts` and pass `enabled={false}` from all five per-type manager hooks to disable their auto-start while the orchestrator is active (prevents duplicate dispatches during migration)

## 2. Phase 2 — Migrate Job Creators (Dialogs)

- [x] 2.1 `apps/ui/src/components/dialogs/download-video-dialog.tsx`: replace `saveDownloadVideoJob` direct IndexedDB write with `createJob(buildDownloadVideoJob(...))` from `useJobOrchestrator()`
- [x] 2.2 `apps/ui/src/components/dialogs/TranscribeDialog.tsx`: replace direct IndexedDB write with `createJob(buildTranscribeJob(...))` from `useJobOrchestrator()`
- [x] 2.3 `apps/ui/src/components/dialogs/SubtitleTranslationDialog.tsx`: replace direct IndexedDB write with `createJob(buildTranslateJob(...))` from `useJobOrchestrator()`
- [x] 2.4 `apps/ui/src/components/dialogs/SynthesizeSubtitleDialog.tsx`: replace direct IndexedDB write with `createJob(buildSynthesizeJob(...))` from `useJobOrchestrator()`
- [x] 2.5 `apps/ui/src/components/dialogs/ProcessPipelineDialog.tsx`: replace direct IndexedDB writes with `createJobs(jobs.map(buildProcessJob(...)))` from `useJobOrchestrator()`; handle `failures[]` in the response to surface partial errors to the user
- [x] 2.6 Verify that menu-triggered downloads (dialog opened from system menu while MusicPanel is unmounted) now auto-start correctly end-to-end

## 3. Phase 3 — Migrate MusicPanel Consumers

- [x] 3.1 In `apps/ui/src/components/MusicPanel.tsx`: replace `useDownloadManager(...)` with `useFileStatuses(platformFolder, 'download-video')` from `useJobOrchestrator()`
- [x] 3.2 Replace `useTranscribeManager(...)` with `useFileStatuses(platformFolder, 'transcribe')`
- [x] 3.3 Replace `useTranslateManager(...)` with `useFileStatuses(platformFolder, 'translate')`
- [x] 3.4 Replace `useSynthesizeManager(...)` with `useFileStatuses(platformFolder, 'synthesize')`
- [x] 3.5 Replace `useProcessManager(...)` with `useFileStatuses(platformFolder, 'process')`
- [x] 3.6 Replace manager-hook start/stop/remove calls in MusicPanel with `startJob(id, options)`, `stopJob(id)`, `removeJob(id)` from `useJobOrchestrator()`
- [x] 3.7 Update MusicPanel table rendering to use `jobIdsByPath` (for displaying full per-path job queues) and `primaryJobIdByPath` (for single-click quick actions like stop/remove)

## 4. Phase 4 — Remove Old Code

- [x] 4.1 Delete `apps/ui/src/hooks/useJobManager.ts` and `apps/ui/src/hooks/useJobManager.test.tsx`
- [x] 4.2 Delete `apps/ui/src/hooks/useDownloadManager.ts`
- [x] 4.3 Delete `apps/ui/src/hooks/useTranscribeManager.ts`
- [x] 4.4 Delete `apps/ui/src/hooks/useTranslateManager.ts`
- [x] 4.5 Delete `apps/ui/src/hooks/useSynthesizeManager.ts`
- [x] 4.6 Delete `apps/ui/src/hooks/useProcessManager.ts` and `apps/ui/src/hooks/useProcessManager.test.tsx`
- [x] 4.7 Delete `apps/ui/src/components/IndexedDbObserver.tsx` and remove its usage from `AppV2.tsx` (or wherever it is mounted)
- [x] 4.8 Delete `apps/ui/src/components/eventlisteners/MediaLibraryImportedEventHandler.tsx` and its test; ensure its `indexed-updated` dispatch logic is covered by the orchestrator's `syncFromIndexedDB`
- [x] 4.9 Run `pnpm typecheck` and fix all resulting type errors
- [x] 4.10 Run `pnpm test:ui` and fix any failing tests caused by removed hooks or changed APIs
