## 1. Setup and Types

- [x] 1.1 Create types/interfaces for background jobs in `ui/src/types/background-jobs.ts`
  - Define `BackgroundJob` interface with: id, name, status, progress
  - Define `JobStatus` enum: pending, running, failed, succeeded, aborted
- [x] 1.2 Create background-jobs directory structure in `ui/src/components/background-jobs/`

## 2. BackgroundJobsProvider

- [x] 2.1 Create `BackgroundJobsProvider` component in `ui/src/components/background-jobs/BackgroundJobsProvider.tsx`
  - Create React Context for jobs state
  - Implement jobs array state and updater functions
  - Add job management functions: addJob, updateJob, abortJob
  - Export `useBackgroundJobs` hook for consuming context
- [x] 2.2 Create `useMockJobs` hook in `ui/src/components/background-jobs/useMockJobs.ts`
  - Implement mock "Scanning Media Library" job creation
  - Use setInterval to simulate progress updates
  - Handle job completion and status changes

## 3. UI Components

- [x] 3.1 Create `BackgroundJobsIndicator` component in `ui/src/components/background-jobs/BackgroundJobsIndicator.tsx`
  - Use Activity or Loader2 icon from lucide-react
  - Conditionally render based on running jobs count
  - Handle click to open popover
  - Style to match StatusBar design
  - Handle missing context gracefully
  - Use Shadcn Popover component for popup
- [x] 3.2 Create `BackgroundJobsPopover` component in `ui/src/components/background-jobs/BackgroundJobsPopover.tsx`
  - Use Shadcn Popover component
  - Display list of jobs using map
  - Show job name, status badge, progress bar for each job
  - Add stop button for running jobs only
  - Handle missing context gracefully

## 4. Integration

- [x] 4.1 Update StatusBar component in `ui/src/components/StatusBar.tsx`
  - Import and add BackgroundJobsIndicator to right side section
  - Position indicator before or after version display
- [x] 4.2 Wrap AppV2 component with BackgroundJobsProvider in `ui/src/AppV2.tsx`
  - Import BackgroundJobsProvider and useMockJobs
  - Wrap existing App content with provider
  - Initialize mock jobs on mount

## 5. Styling and Polish

- [x] 5.1 Add status badge colors in BackgroundJobsPopover
  - Blue for running, green for succeeded, red for failed, yellow for pending, gray for aborted
- [x] 5.2 Implement progress bar for running jobs
  - Check if Progress component exists in Shadcn UI
  - If not, create simple progress bar with div and Tailwind
  - Update progress dynamically as jobs advance
- [x] 5.3 Test responsive behavior and popover positioning
  - Ensure popover doesn't overflow on small screens
  - Verify click-outside-to-close works correctly
  - Test with multiple jobs to ensure scrolling works
  - Handle missing context gracefully for App.tsx compatibility
  - Use Shadcn Popover component for consistent behavior

## 6. Testing

- [x] 6.1 Manual test: Verify indicator shows/hides correctly
  - Start with no jobs - indicator should be hidden
  - Add mock job - indicator should appear
  - Complete all jobs - indicator should disappear
- [x] 6.2 Manual test: Test popover functionality
  - Click indicator - popover opens with job list
  - Click outside - popover closes
  - Stop button on running job - job status changes to aborted
- [x] 6.3 Manual test: Verify job progress updates
  - Mock job should progress from 0 to 100
  - Progress bar should update smoothly
  - Job status should change to succeeded when complete
