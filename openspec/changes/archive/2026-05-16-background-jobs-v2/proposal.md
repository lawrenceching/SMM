## Why

The current background job system is coupled to MusicPanel's lifecycle and folder scope, meaning jobs created from the menu, MCP, or other sources while MusicPanel is unmounted are never started. Five nearly-identical per-type manager hooks duplicate SW listener and auto-start logic, and adding a new job type requires invasive changes across multiple files.

## What Changes

- **New** `src/lib/jobTypeRegistry.ts` — data-driven registry of all job types; the single extension point for adding new types
- **New** `src/components/JobOrchestratorProvider.tsx` — app-level, always-mounted provider owning the IndexedDB ↔ Zustand ↔ SW bridge; type-agnostic, driven entirely by the registry
- **New** `src/hooks/useJobOrchestrator.ts` — React context hook exposing imperative API (`createJob`, `createJobs`, `startJob`, `stopJob`, `removeJob`) and reactive selectors (`useFileStatuses`, `useJobIndicatorState`)
- Migrate 5 dialogs (`DownloadVideoDialog`, `TranscribeDialog`, `SubtitleTranslationDialog`, `SynthesizeSubtitleDialog`, `ProcessPipelineDialog`) from direct IndexedDB writes to `createJob(factory(...))`
- Simplify `MusicPanel` — replace 5 per-type manager hooks with `useFileStatuses(folder, type)` calls
- Mount `<JobOrchestratorProvider>` at app root (`AppV2.tsx`) so it is always alive
- Expose `window.__jobOrchestrator` for non-React consumers (MCP tools)
- **Remove** (phase 4): `useJobManager`, `useDownloadManager`, `useTranscribeManager`, `useTranslateManager`, `useSynthesizeManager`, `useProcessManager`, `IndexedDbObserver`, `MediaLibraryImportedEventHandler`

## Capabilities

### New Capabilities

- `job-orchestrator`: App-level `JobOrchestratorProvider` with its full lifecycle (SW registration, startup reconciliation, auto-start queue, generic SW message handler) and the imperative + reactive API surface exposed via React context
- `job-type-registry`: Extensible `JOB_TYPE_REGISTRY` data module; defines per-type metadata (SW message prefix, auto-start localStorage key, path extraction function, optional lifecycle toasts); drives the orchestrator generically with zero per-type branches

### Modified Capabilities

<!-- No existing specs have requirement-level changes. The orchestrator replaces
     implementation mechanisms (manager hooks), not the user-visible behaviors
     those specs describe. -->

## Impact

- **apps/ui** — core change; touches `AppV2.tsx`, `MusicPanel.tsx`, all 5 dialogs, and removes 6 hook files and 2 event-listener components
- **Persistence layer unchanged** — `downloadTaskDb.ts` (IndexedDB) and `download-service-worker.js` (SW) keep existing interfaces; only the React layer above them changes
- **MCP tools** — gain a reliable `window.__jobOrchestrator` handle instead of the current fire-and-hope `indexed-updated` pattern
- **No breaking changes to the IndexedDB schema or SW message protocol**
