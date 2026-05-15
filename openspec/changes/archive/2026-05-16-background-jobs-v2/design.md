## Context

The UI app (`apps/ui`) currently manages background jobs (download, transcribe, translate, synthesize, process) through five per-type React hooks (`useDownloadManager`, `useTranscribeManager`, etc.), each wrapping a shared `useJobManager`. These hooks are only active when `MusicPanel` is mounted, which means:

- Jobs created from the system menu or MCP tools while MusicPanel is unmounted are persisted to IndexedDB but never auto-started.
- Each hook independently attaches SW message listeners and `indexed-updated` event listeners, creating duplicated plumbing.
- Adding a new job type requires changes to hook files, manager files, orchestrator type definitions, and SW message handling.

The persistence layer (`downloadTaskDb.ts` using Dexie/IndexedDB) and the Service Worker (`download-service-worker.js`) are stable and correct; only the React coordination layer above them needs to change.

## Goals / Non-Goals

**Goals:**
- Mount a single `JobOrchestratorProvider` at app root (always alive) that owns all IndexedDB ↔ Zustand ↔ SW coordination
- Eliminate per-type branches in the orchestrator; drive all type-specific behavior from `JOB_TYPE_REGISTRY`
- Expose a clean imperative API (`createJob`, `createJobs`, `startJob`, `stopJob`, `removeJob`) and reactive selectors (`useFileStatuses`, `useJobIndicatorState`) via React context
- Fix the menu/MCP job creation bug (jobs now reliably start regardless of which panel is mounted)
- Make adding a new job type a data-level change only (registry entry + factory + SW handler + dialog)

**Non-Goals:**
- Changing the IndexedDB schema or `downloadTaskDb.ts` interface
- Changing the Service Worker's overall message protocol or per-type handlers
- Real-time progress granularity beyond existing SW heartbeat
- Job persistence policy changes (the existing `isWithinOneHour` filter is preserved)
- Changing the `backgroundJobsStore.ts` Zustand store structure

## Decisions

### D1: Single app-level provider, not a per-panel hook

**Decision:** `JobOrchestratorProvider` is mounted once at app root, above all panels and dialogs.

**Rationale:** The fundamental bug is that job management is tied to MusicPanel's lifetime. Moving it to app root decouples job lifecycle from UI navigation entirely. Any alternative that still mounts per-panel would perpetuate the root cause.

**Alternative considered:** A global singleton store (pure Zustand, no React component). Rejected because SW registration and message listeners have natural cleanup via `useEffect` teardown in a provider, and React context makes the API available without module-level singletons that complicate testing.

---

### D2: Registry-driven orchestrator with no per-type branches

**Decision:** A `JOB_TYPE_REGISTRY: Record<string, JobTypeConfig>` data module drives all type-specific behavior. The orchestrator reads this registry generically and never imports job-type-specific code.

**Rationale:** Eliminates the need to touch the orchestrator when adding a new type. The only things that vary per type (SW message prefix, auto-start localStorage key, path extraction, toast messages) are small enough to express as data.

**Alternative considered:** A polymorphic handler interface (each type registers a class). Rejected as over-engineering — the per-type variation is only ~4 fields; a plain object record is sufficient and easier to read.

---

### D3: `createJob` accepts a pre-built `BackgroundJob`, not a params union

**Decision:** Callers build the job object using a factory function and pass it to `createJob(job)`. The orchestrator does not know job-type-specific params.

**Rationale:** The orchestrator's API never needs to change when a new type is added. The factory functions (already exist) handle construction; the orchestrator handles persistence and scheduling. This keeps the orchestrator stable and the factory pattern consistent.

**Alternative considered:** `createJob(type, params)` with a discriminated union. Rejected because it would require the orchestrator to import all type-specific param types and update the union on every new type.

---

### D4: `createJobs` uses non-transactional semantics

**Decision:** `createJobs(jobs)` persists each job independently. Partial failure is allowed; the return value includes `successIds` and `failures[]` so callers can retry.

**Rationale:** IndexedDB does not natively support multi-record transactions across the Dexie abstraction used here. Attempting all-or-nothing rollback would require additional complexity for a case that is rare in practice (a single IndexedDB write rarely fails). Callers that need atomicity can handle it at the UI level.

---

### D5: `startJob` defaults to non-preemptive, `forceStart` as opt-in

**Decision:** `startJob(id)` respects the concurrency guard (max 1 running per `(type, folder)`). `startJob(id, { forceStart: true })` bypasses both the concurrency guard and the auto-start preference toggle.

**Rationale:** The default preserves the scheduling contract — the auto-start queue is the expected path. `forceStart` is for explicit user action (e.g., "start now" button) where the user intentionally overrides the queue.

---

### D6: `window.__jobOrchestrator` bridge for non-React consumers

**Decision:** On mount, the provider writes `window.__jobOrchestrator = { createJob, createJobs, startJob, stopJob, removeJob, isReady }`.

**Rationale:** MCP tools and Electron IPC handlers operate outside React. A window-level handle is the simplest stable interface; it avoids the need to thread context through non-component code.

---

### D7: Incremental 4-phase migration

**Decision:** Migrate in phases: (1) create orchestrator, (2) migrate job creators, (3) migrate MusicPanel consumers, (4) delete old code.

**Rationale:** Each phase is independently testable and can be deployed incrementally. Phase 1 and 2 together fix the menu bug. Phases 3–4 are cleanup. This avoids a big-bang rewrite and allows partial rollback.

**Key constraint for Phase 1:** Old manager hooks must have their auto-start disabled when the new orchestrator is active to avoid duplicate job dispatch. The recommended approach is to disable auto-start in the old hooks as soon as the orchestrator mounts.

---

### D8: `useFileStatuses` supports multiple jobs per path via `jobIdsByPath`

**Decision:** `useFileStatuses` returns `jobIdsByPath: Map<string, string[]>` (all job IDs for a path) and `primaryJobIdByPath: Map<string, string>` (the highest-priority job for quick actions). Priority: running > pending > failed > other.

**Rationale:** The existing system silently discarded earlier jobs when the same path appeared twice. The new design surfaces the full queue to the UI while providing a sensible default for single-action affordances (e.g., a "stop" button that targets the running job).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Duplicate auto-start during Phase 1 (both old managers and new orchestrator running simultaneously) | Disable auto-start in old manager hooks as the first act of Phase 1; they become read-only status observers until removed in Phase 4 |
| `window.__jobOrchestrator` set after component render, MCP tool calls it before mount | `isReady()` check; MCP tools should poll or wait for `isReady` before calling; provider mounts at app root so window is available within the first render cycle |
| SW message events arrive before `syncFromIndexedDB` completes (async race) | Idempotent re-sync on every SW event; the Zustand store reflects IndexedDB truth after each sync, so late arrivals self-correct |
| `createJobs` partial failure leaves orphaned pending jobs | Jobs in `pending` state are auto-started when the orchestrator next reconciles; orphaned jobs do not block the queue |
| Removing `IndexedDbObserver` and `MediaLibraryImportedEventHandler` in Phase 4 breaks something unexpected | Audit usages before Phase 4; these components currently only dispatch `indexed-updated`  which the orchestrator replaces with direct `syncFromIndexedDB` calls |

## Migration Plan

**Phase 1 — Create orchestrator infrastructure**
1. Create `src/lib/jobTypeRegistry.ts` with all 5 current job types
2. Create `src/components/JobOrchestratorProvider.tsx`
3. Create `src/hooks/useJobOrchestrator.ts`
4. Mount `<JobOrchestratorProvider>` in `AppV2.tsx`
5. Disable auto-start in all existing manager hooks (they remain for read-only status until Phase 3)
6. Verify: jobs created from MCP/menu start correctly; no duplicate dispatches

**Phase 2 — Migrate job creators**
1. `DownloadVideoDialog`: `saveDownloadVideoJob` → `createJob(buildDownloadVideoJob(...))`
2. `TranscribeDialog` → `createJob(buildTranscribeJob(...))`
3. `SubtitleTranslationDialog` → `createJob(buildTranslateJob(...))`
4. `SynthesizeSubtitleDialog` → `createJob(buildSynthesizeJob(...))`
5. `ProcessPipelineDialog` → `createJob(buildProcessJob(...))`
6. Verify: menu download bug fixed; all dialogs create jobs that auto-start

**Phase 3 — Migrate MusicPanel consumers**
1. Replace `useDownloadManager` → `useFileStatuses(folder, 'download-video')`
2. Replace `useTranscribeManager` → `useFileStatuses(folder, 'transcribe')`
3. Same for translate, synthesize, process
4. Replace start/stop/remove calls with context API
5. Update UI to use `jobIdsByPath` / `primaryJobIdByPath` where relevant

**Phase 4 — Remove old code**
1. Delete `useJobManager.ts`, `useDownloadManager.ts`, `useTranscribeManager.ts`, `useTranslateManager.ts`, `useSynthesizeManager.ts`, `useProcessManager.ts`
2. Delete `IndexedDbObserver.tsx`
3. Delete `MediaLibraryImportedEventHandler.tsx`
4. Run full typecheck and test suite

**Rollback:** Each phase is independently reversible. The orchestrator can be unmounted and old hooks re-enabled without data loss (IndexedDB is unchanged throughout).

## Open Questions

- Should `useFileStatuses` filter out jobs older than 1 hour (matching the existing `isWithinOneHour` filter in `useJobManager`)? Currently assumed yes, to maintain consistent UI behavior.
- Should the `window.__jobOrchestrator` bridge be typed in a global `.d.ts` file, or left as `any` for now? Recommended: typed declaration in a `global.d.ts` to prevent MCP tool type errors.
- Phase 1 constraint: what is the exact mechanism to disable auto-start in old manager hooks without a full rewrite? Recommended: add an `enabled` prop to `useJobManager` and pass `enabled={false}` when the new orchestrator is active (feature-flagged via a context check).
