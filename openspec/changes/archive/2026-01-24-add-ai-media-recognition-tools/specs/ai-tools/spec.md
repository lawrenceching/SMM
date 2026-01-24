## ADDED Requirements

### Requirement: AI-Driven Media File Recognition Task
The system SHALL provide AI tools that allow AI agents to create a media file recognition plan for review.

#### Scenario: Begin recognition task
- **WHEN** AI agent calls `beginRecognizeTask` with a media folder path
- **THEN** the system generates a unique task UUID
- **AND** creates the plans directory `${userDataDir}/plans/` if it doesn't exist
- **AND** creates a plan file `{taskId}.plan.json` in `${userDataDir}/plans/` directory
- **AND** initializes the plan file with `task: "recognize-media-file"`, `mediaFolderPath`, and empty `files` array
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
  - `task: "recognize-media-file"`
  - `mediaFolderPath: string` (absolute path in POSIX format)
  - `files: RecognizedFile[]` where each file has:
    - `season: number`
    - `episode: number`
    - `path: string` (absolute path in POSIX format)
