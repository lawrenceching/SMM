# ai-tools Specification

## Purpose
TBD - created by archiving change add-ai-media-recognition-tools. Update Purpose after archive.
## Requirements
### Requirement: AI-Driven Media File Recognition Task
The system SHALL provide AI tools that allow AI agents to create a media file recognition plan for review.

#### Scenario: Begin recognition task
- **WHEN** AI agent calls `beginRecognizeTask` with a media folder path
- **THEN** the system generates a unique task UUID
- **AND** creates the plans directory `${userDataDir}/plans/` if it doesn't exist
- **AND** creates a plan file `{taskId}.plan.json` in `${userDataDir}/plans/` directory
- **AND** initializes the plan file with `task: "recognize-media-file"`, `id` (set to the generated UUID), `status: "pending"`, `mediaFolderPath`, and empty `files` array
- **AND** returns the task ID to the AI agent

#### Scenario: Add recognized file to task
- **WHEN** AI agent calls `addRecognizedMediaFile` with a task ID, season, episode, and file path
- **THEN** the system reads the existing plan file for the task
- **AND** adds the recognized file entry to the `files` array in the plan
- **AND** writes the updated plan back to the file
- **AND** returns success to the AI agent

#### Scenario: End recognition task and notify UI
- **WHEN** AI agent calls `endRecognizeTask` with a task ID
- **THEN** the system reads the final plan file
- **AND** broadcasts a Socket.IO event to notify the UI that the recognition plan is ready for review
- **AND** the event includes the task ID and plan file path
- **AND** returns success to the AI agent

#### Scenario: Handle invalid task ID
- **WHEN** AI agent calls `addRecognizedMediaFile` or `endRecognizeTask` with a non-existent task ID
- **THEN** the system returns an error message indicating the task was not found

#### Scenario: Plan file format matches RecognizeMediaFilePlan
- **WHEN** a recognition task plan file is created or updated
- **THEN** the file content SHALL conform to the `RecognizeMediaFilePlan` interface:
  - `id: string` (UUID)
  - `task: "recognize-media-file"`
  - `status: "pending" | "completed" | "rejected"`
  - `mediaFolderPath: string` (absolute path in POSIX format)
  - `files: RecognizedFile[]` where each file has:
    - `season: number`
    - `episode: number`
    - `path: string` (absolute path in POSIX format)

### Requirement: Plan status update (reject or complete)
The system SHALL allow the frontend to update a pending recognition plan's status to "rejected" or "completed" via `/api/updatePlan`.

#### Scenario: Update plan via API (reject or complete)
- **WHEN** a client calls `/api/updatePlan` with a request body containing `planId` and `status` ("rejected" or "completed")
- **THEN** the system reads the plan file for the given plan ID
- **AND** validates that the plan exists and has status "pending"
- **AND** updates the plan status to the given value
- **AND** writes the updated plan back to the file
- **AND** returns success response to the client

#### Scenario: Update non-existent plan
- **WHEN** a client calls `/api/updatePlan` with a non-existent plan ID
- **THEN** the system returns an error response indicating the plan was not found

#### Scenario: Update already processed plan
- **WHEN** a client calls `/api/updatePlan` with a plan ID that has status "completed" or "rejected"
- **THEN** the system returns an error response indicating the plan cannot be updated

#### Scenario: Frontend rejects plan on cancel
- **WHEN** user clicks the cancel button in AiRecognizePrompt for a pending recognition plan
- **THEN** the frontend calls `/api/updatePlan` with the plan's ID and `status: "rejected"`
- **AND** the plan status is updated to "rejected" on the backend
- **AND** the UI handles the response appropriately (closes prompt, shows error if update failed)

#### Scenario: Frontend completes plan on confirm
- **WHEN** user clicks the confirm button in AiRecognizePrompt and recognition is applied successfully
- **THEN** the frontend calls `/api/updatePlan` with the plan's ID and `status: "completed"`
- **AND** the plan status is updated to "completed" on the backend
- **AND** the plan is removed from the pending list in the UI

### Requirement: AI-Driven Rename Files Task V2
The system SHALL provide AI tools that allow AI agents to create a rename-files plan for review, following the same plan-on-disk and confirm/reject pattern as AI-driven recognition. Legacy rename tools (`beginRenameFilesTask`, `addRenameFileToTask`, `endRenameFilesTask`) SHALL remain unchanged.

#### Scenario: Begin rename task V2
- **WHEN** AI agent calls `beginRenameFilesTaskV2` with a media folder path
- **THEN** the system generates a unique task UUID and plan ID
- **AND** creates or reuses the plans directory `${userDataDir}/plans/`
- **AND** creates a plan file `{taskId}.plan.json` with `task: "rename-files"`, `status: "pending"`, `mediaFolderPath` (POSIX), and empty `files` array
- **AND** returns the task ID to the AI agent

#### Scenario: Add rename file to task V2
- **WHEN** AI agent calls `addRenameFileToTaskV2` with a task ID, source path, and destination path
- **THEN** the system reads the existing plan file for the task
- **AND** appends one entry `{ from, to }` (POSIX paths) to the plan's `files` array
- **AND** writes the updated plan back to the file
- **AND** returns success to the AI agent

#### Scenario: End rename task V2 and notify UI
- **WHEN** AI agent calls `endRenameFilesTaskV2` with a task ID
- **THEN** the system reads the final plan file
- **AND** ensures the task exists and has at least one file
- **AND** broadcasts a Socket.IO event to notify the UI that the rename plan is ready for review
- **AND** the event includes the task ID and plan file path (or equivalent)
- **AND** returns success to the AI agent

#### Scenario: Handle invalid task ID in V2
- **WHEN** AI agent calls `addRenameFileToTaskV2` or `endRenameFilesTaskV2` with a non-existent task ID
- **THEN** the system returns an error indicating the task was not found

#### Scenario: Reject empty plan in endRenameFilesTaskV2
- **WHEN** AI agent calls `endRenameFilesTaskV2` with a task that has no files
- **THEN** the system returns an error and does not broadcast the plan-ready event

#### Scenario: Rename plan file format
- **WHEN** a rename task V2 plan file is created or updated
- **THEN** the file content SHALL conform to the `RenameFilesPlan` type:
  - `id: string` (UUID)
  - `task: "rename-files"`
  - `status: "pending" | "completed" | "rejected"`
  - `mediaFolderPath: string` (absolute path in POSIX format)
  - `files: { from: string, to: string }[]` (absolute paths in POSIX format)

### Requirement: Rename plan status update and pending list (V2)
The system SHALL allow the frontend to list pending rename plans and to update a pending rename plan's status to "rejected" or "completed" via the existing update-plan mechanism or a dedicated rename-plan API, consistent with the recognition flow.

#### Scenario: List pending rename plans
- **WHEN** a client requests pending plans (via extended get-pending-plans or dedicated get-pending-rename-plans)
- **THEN** the system returns all plans with `task === "rename-files"` and `status === "pending"` from the plans directory
- **AND** each entry conforms to `RenameFilesPlan`

#### Scenario: Update rename plan status (reject or complete)
- **WHEN** a client calls the update-plan API with a plan ID that refers to a rename plan and `status` is "rejected" or "completed"
- **THEN** the system validates that the plan exists and has status "pending"
- **AND** updates the plan status and persists it
- **AND** returns success to the client

#### Scenario: Frontend completes rename plan on confirm
- **WHEN** the user confirms the rename plan in the UI
- **THEN** the frontend runs validation and batch rename using the plan's `files` (or invokes an API that does so)
- **AND** on success, calls the update-plan API with that plan's ID and `status: "completed"`
- **AND** the plan is removed from the pending list in the UI

#### Scenario: Frontend rejects rename plan on cancel
- **WHEN** the user cancels the rename plan in the UI
- **THEN** the frontend calls the update-plan API with that plan's ID and `status: "rejected"`
- **AND** the plan is removed from the pending list and no renames are performed

