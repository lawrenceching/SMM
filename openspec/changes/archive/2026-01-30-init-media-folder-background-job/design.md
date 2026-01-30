## Context

The `useInitializeMediaFolderEventHandler.ts` currently implements media folder initialization as a synchronous operation with a hard 10-second timeout. When a user imports a media folder, the handler performs several operations sequentially: reading media metadata, adding to user config, and preprocessing the folder. These operations block the UI thread and provide no feedback to users about progress or intermediate results.

The existing `BackgroundJobsProvider` infrastructure provides job tracking, progress display, and abort capabilities through the `BackgroundJobsIndicator` component in the status bar. This change will leverage that infrastructure to make media folder initialization a proper background job.

## Goals / Non-Goals

**Goals:**
- Integrate media folder initialization with `BackgroundJobsProvider` for job tracking
- Provide real-time progress updates as initialization moves through stages
- Enable users to abort long-running or stuck initialization tasks
- Display job status and progress in the existing `BackgroundJobsIndicator` UI
- Remove the hard 10-second timeout in favor of user-controlled abort

**Non-Goals:**
- Modify `doPreprocessMediaFolder` internal implementation (already supports abort signal)
- Change the API responses or backend behavior
- Add persistent job storage across application restarts (jobs are session-scoped)
- Implement job queuing or prioritization

## Decisions

### 1. Job Creation Strategy

**Decision:** Create a job at the start of `onFolderImported` callback before any async operations begin.

**Rationale:**
- Provides immediate user feedback that the import has started
- Allows abort even if subsequent operations fail early
- Job ID can be used as the traceId for consistent logging

**Alternative Considered:** Create job after initial validation
- **Rejected:** May miss early failures and creates inconsistent job lifecycle

### 2. Progress Stage Mapping

**Decision:** Define clear progress stages with percentage increments:

| Stage | Progress | Description |
|-------|----------|-------------|
| pending | 0% | Job created, awaiting start |
| reading_metadata | 10-40% | Reading media metadata from API |
| preprocessing | 40-80% | Running `doPreprocessMediaFolder` |
| completing | 80-95% | Finalizing and updating state |
| succeeded | 100% | Initialization complete |

**Rationale:**
- Provides meaningful feedback at each major operation
- Progress bar shows visible advancement
- Matches existing mental model of folder import flow

### 3. Abort Signal Integration

**Decision:** Use the existing AbortController pattern and pass its signal through all async operations. When user aborts via `BackgroundJobsProvider.abortJob()`, the signal is set to aborted and caught by existing abort handling.

**Implementation approach:**
```typescript
// Create AbortController tied to job lifecycle
const abortController = new AbortController();

// When job is aborted via provider, the handler checks signal.aborted
// and propagates the abort through API calls (which already support signal)
```

**Rationale:**
- Backend API already supports abort signals
- No changes needed to `doPreprocessMediaFolder` (already accepts signal)
- Follows existing cancellation patterns in the codebase

### 4. Job Type Definition

**Decision:** Extend `BackgroundJob` with media-folder-specific type in a new file `ui/src/types/media-folder-init-job.ts`.

**Rationale:**
- Keeps job type definitions organized and reusable
- Allows for future job-specific metadata (folder path, media type, etc.)
- Matches existing patterns for type organization

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Job created but operation fails immediately | Job shows in list with no clear error | Set job status to 'failed' with error message on unhandled exceptions |
| Race condition between timeout and abort | Confusing state if both triggered | Use abort signal as single source of truth; timeout is advisory |
| Multiple folder imports in parallel | Multiple jobs compete for attention | Each job is independent; UI shows count of running jobs |
| User closes app during initialization | Job progress is lost | Jobs are session-scoped; this is acceptable for MVP |

## Migration Plan

1. Create new type definition file for media folder init job
2. Update `useInitializeMediaFolderEventHandler.ts` to:
   - Import `useBackgroundJobs` hook
   - Create job at start of `onFolderImported`
   - Update progress at each stage
   - Handle job completion and errors
   - Check abort signal throughout operation
3. Test with single and multiple folder imports
4. Verify abort functionality at various stages

**Rollback:** If issues arise, revert `useInitializeMediaFolderEventHandler.ts` to original implementation. The BackgroundJobsProvider changes are additive and don't affect other functionality.

## Open Questions

1. Should the job automatically open the folder in the UI upon successful completion, or just update the list silently?
2. Should there be a visual indicator in the main UI (not just status bar) when a background job is running?
