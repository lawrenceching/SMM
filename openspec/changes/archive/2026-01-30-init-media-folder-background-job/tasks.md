## 1. Type Definitions

- [x] 1.1 Create `ui/src/types/media-folder-init-job.ts`
  - Define `MediaFolderInitJob` interface extending `BackgroundJob`
  - Add fields: `folderPath`, `mediaType`, `startedAt`, `stages`
  - Define `InitStage` type: 'reading_metadata' | 'preprocessing' | 'completing'
  - Export type and helper functions for job creation

## 2. BackgroundJobsProvider Updates

- [x] 2.1 Review `BackgroundJobsProvider` API for extensibility
  - Check if `addJob` accepts partial job object or only name
  - Verify `updateJob` handles progress updates correctly
- [x] 2.2 Extend `addJob` to accept optional initial data
  - Allow setting initial progress, status, and custom fields
  - Maintain backward compatibility with string-only overload

## 3. useInitializeMediaFolderEventHandler Integration

- [x] 3.1 Import and initialize `useBackgroundJobs` hook
  - Add hook call to access jobs context
  - Handle missing provider gracefully (no-op if not available)

- [x] 3.2 Create job at start of `onFolderImported`
  - Call `addJob` with descriptive name including folder path
  - Store job ID for subsequent updates
  - Use job ID as traceId for consistent logging

- [x] 3.3 Add progress update function
  - Create helper to update job progress and stage
  - Update progress at each major operation boundary

- [x] 3.4 Implement stage-based progress tracking
  - Add progress update before calling `readMediaMetadataApi`
  - Update progress after metadata read completes (10-40%)
  - Update progress when preprocessing starts (40%)
  - Update progress during `doPreprocessMediaFolder` via callbacks
  - Update progress during finalization (80-95%)

- [x] 3.5 Integrate abort signal with job lifecycle
  - Create AbortController at job start
  - Pass signal to all async operations
  - Check `signal.aborted` between operation stages
  - Handle abort by updating job status to 'aborted'

- [x] 3.6 Handle job completion and errors
  - On success: update status to 'succeeded', progress to 100%
  - On error: update status to 'failed', log error
  - On abort: update status to 'aborted', clean up state

## 4. Cleanup and Verification

- [x] 4.1 Remove hardcoded 10-second timeout
  - Replace timeoutPromise with job-based abort
  - Keep timeout as safeguard but don't rely on it

- [ ] 4.2 Manual testing: Single folder import
  - Import a media folder
  - Verify job appears in status bar indicator
  - Verify progress updates during stages
  - Verify job completes with 100% progress
  - Verify folder appears in UI after completion

- [ ] 4.3 Manual testing: Abort functionality
  - Start folder import
  - Click abort button in jobs popover
  - Verify job status changes to 'aborted'
  - Verify no further processing occurs
  - Verify UI remains responsive

- [ ] 4.4 Manual testing: Multiple folder imports
  - Import multiple folders simultaneously
  - Verify all jobs appear in indicator
  - Verify each job can be tracked independently
  - Verify popover shows all jobs with correct status
