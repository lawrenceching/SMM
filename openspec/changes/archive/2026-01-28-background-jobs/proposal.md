## Why

The application needs to track and display long-running operations (e.g., media library scanning) to provide users with visibility into background processes and allow them to manage these operations (e.g., abort jobs). Currently, there's no UI mechanism to show or manage background jobs.

## What Changes

- Add background job status indicator in StatusBar that shows only when jobs are running
- Implement popover component that displays list of background jobs with their status
- Each job displays: name, status (pending, running, failed, succeeded), and progress
- Add abort/stop button for each running job in the list
- Create mock background job system with a "Scanning Media Library" job for demonstration
- No real background job implementation yet - UI only

## Capabilities

### New Capabilities
- `background-jobs-ui`: UI components for displaying and managing background jobs in the status bar and popover

### Modified Capabilities
- None (this is purely new UI functionality)

## Impact

- **Components**: Create `BackgroundJobsIndicator`, `BackgroundJobsPopover`, and related components
- **StatusBar**: Add background job indicator that conditionally renders
- **State Management**: Add background jobs state (using React context or provider)
- **Mock Data**: Create mock background job system for demonstration purposes
- **No Backend Changes**: This is UI-only implementation with mock data
