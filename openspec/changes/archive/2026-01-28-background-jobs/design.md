## Context

The application currently has no mechanism to display or manage background operations. Users cannot see the status of long-running tasks like media library scanning, AI recognition, or file operations. The StatusBar component exists but only shows connection status and version information.

This change introduces a UI-only system for displaying background jobs with the following constraints:
- No real background job implementation (use mock data)
- Must integrate with existing StatusBar component
- Should use existing UI library (Shadcn components)
- Should follow React state management patterns used in the application

## Goals / Non-Goals

**Goals:**
- Provide visibility into background job status through StatusBar indicator
- Allow users to view detailed job information in a popover
- Enable users to abort running jobs
- Create a mock background job system for demonstration
- Keep implementation simple and focused on UI only

**Non-Goals:**
- Real background job execution engine
- Backend API integration
- Persistent job storage
- Complex job scheduling or queuing
- Job retry or failure recovery logic

## Decisions

### 1. State Management: React Context Pattern
**Decision**: Create a `BackgroundJobsProvider` using React Context to manage background jobs state globally.

**Rationale**:
- Consistent with existing patterns in the application (e.g., `ConfigProvider`, `MediaMetadataProvider`)
- Allows StatusBar and popover to access same job data without prop drilling
- Easy to mock jobs and update state for demonstration
- Simple to add real job system later by swapping provider implementation

**Alternatives Considered**:
- Global store (Zustand/Redux): Overkill for this scope
- Component state: Would require prop drilling through App hierarchy
- Backend sync: Out of scope (UI-only requirement)

### 2. Job Indicator Icon: Activity Icon
**Decision**: Use an activity/spinner icon (lucide-react Activity or Loader2) as the indicator.

**Rationale**:
- Intuitive visual representation of ongoing work
- Common pattern in desktop apps (VS Code, Slack, etc.)
- Available in lucide-react (already used in project)
- Spinner animation for running jobs provides clear feedback

### 3. Popover Component: Shadcn Popover
**Decision**: Use existing `Popover` component from Shadcn UI library.

**Rationale**:
- Already installed and used in the project
- Provides click-outside-to-close behavior out of the box
- Consistent with other UI components
- Handles positioning and accessibility

### 4. Job Status Display: Color-coded Badges
**Decision**: Use color-coded badges to distinguish job statuses.

**Rationale**:
- Visual distinction makes scanning easy
- Common UI pattern (green=succeeded, red=failed, blue=running, yellow=pending)
- Leverages existing badge component patterns
- Can be implemented with Tailwind classes

### 5. Progress Display: Progress Bar Component
**Decision**: Create or use existing Progress component to show job completion percentage.

**Rationale**:
- Visual representation of job progress
- Standard UI pattern for background operations
- May already exist in Shadcn UI (check components)
- Shows 0-100 scale clearly

### 6. Mock Job Implementation: Simple State Updates
**Decision**: Create a `useMockJobs` hook that creates and updates mock jobs via setInterval.

**Rationale**:
- Simulates real job behavior without backend
- Easy to start/stop jobs for testing
- Progress updates demonstrate UI functionality
- Can be replaced with real job hook later

### 7. Component Structure
**Decision**: Create three new components:
- `BackgroundJobsProvider`: Context provider for job state
- `BackgroundJobsIndicator`: Icon indicator for StatusBar
- `BackgroundJobsPopover`: Popover with job list

**Rationale**:
- Separation of concerns (state, indicator, list)
- Reusable components
- Clear responsibility boundaries
- Easy to test individual pieces

## Risks / Trade-offs

### Risk: Mock job system may not represent real job behavior
**Impact**: When real jobs are implemented, UI assumptions may not match actual behavior
**Mitigation**: Keep mock job properties generic and extensible; design provider interface to support real job patterns

### Risk: StatusBar layout may become crowded
**Impact**: Adding indicator may push content or cause overflow
**Mitigation**: Place indicator in existing right-side section with version; use compact icon design

### Trade-off: UI-only vs Full Implementation
**Decision**: Implement UI only with mock data as requested
**Trade-off**: Faster delivery now vs. real job system later
**Impact**: Need to refactor provider and hooks when real jobs are implemented

### Risk: Popover may close during job updates
**Impact**: User may lose context if state update triggers re-render that closes popover
**Mitigation**: Ensure popover state is managed independently; use controlled popover component

## Migration Plan

Since this is new functionality with no breaking changes:

1. Create new components in `ui/src/components/background-jobs/`
2. Wrap App component with BackgroundJobsProvider in AppV2.tsx
3. Add BackgroundJobsIndicator to StatusBar component
4. Test with mock jobs
5. (Future) Replace mock job hook with real job system

No migration needed for existing code - additive change only.

## Open Questions

1. Should the job list show all historical jobs or just active/completed jobs?
   - *Assumption*: Show all jobs for now, can add filtering later

2. What happens when all jobs are aborted/failed - should indicator stay visible?
   - *Assumption*: Indicator only shows when jobs are running or pending

3. Should there be a "Clear History" button to remove completed/failed jobs?
   - *Assumption*: Out of scope for MVP, can add in future iteration

4. How many mock jobs should we create for demonstration?
   - *Assumption*: One "Scanning Media Library" job as specified in requirements
