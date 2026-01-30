## Why

The current media folder initialization in `useInitializeMediaFolderEventHandler.ts` runs synchronously with no user visibility into progress. Users cannot abort long-running operations, receive no real-time feedback, and face a hard 10-second timeout with no way to extend it. This creates a poor user experience, especially for large media libraries that require extended processing time.

## What Changes

- Convert `useInitializeMediaFolderEventHandler.ts` to use the existing `BackgroundJobsProvider` for job tracking
- Add job creation at the start of folder initialization with meaningful progress stages
- Implement progress callbacks to update job status as media folder processing advances
- Integrate abort signal propagation from `BackgroundJob` to `doPreprocessMediaFolder` and API calls
- Display initialization progress in the `BackgroundJobsIndicator` in the status bar
- Allow users to abort stuck or unwanted initialization tasks via the jobs popover
- Add progress tracking for key stages: metadata reading, preprocessing, and completion

## Capabilities

### New Capabilities
- `media-folder-init-job`: Tracks the complete media folder initialization workflow as a background job, providing progress visibility, abort capability, and real-time status updates to users

### Modified Capabilities
- None (this introduces a new capability without changing existing spec requirements)

## Impact

- **Modified Files:**
  - `ui/src/hooks/eventhandlers/useInitializeMediaFolderEventHandler.ts` - Main implementation change
  - `ui/src/components/background-jobs/BackgroundJobsProvider.tsx` - May need extended API for job callbacks
- **New Files:**
  - `ui/src/types/media-folder-init-job.ts` - Job type definitions for media folder initialization
- **Dependencies:**
  - Existing `BackgroundJobsProvider` context and hooks
  - Existing `BackgroundJobsIndicator` component in StatusBar
  - `doPreprocessMediaFolder` function supports abort signal
