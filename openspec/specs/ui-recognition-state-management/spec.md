### Requirement: Temporary recognition plan creation
The system SHALL allow the frontend to create temporary recognition plans with `tmp: true` without backend persistence.

#### Scenario: Create temporary plan on button click
- **WHEN** user clicks the "Recognize" button in rule-based mode
- **THEN** system generates a `UIRecognizeMediaFilePlan` with `tmp: true`
- **AND** system adds the plan to global `pendingPlans` state
- **AND** system does NOT call backend API to persist the plan

#### Scenario: Temporary plan structure
- **WHEN** a temporary recognition plan is created
- **THEN** plan.id SHALL be a UUID
- **AND** plan.task SHALL equal "recognize-media-file"
- **AND** plan.status SHALL equal "pending"
- **AND** plan.tmp SHALL equal true
- **AND** plan.mediaFolderPath SHALL match the current media folder
- **AND** plan.files SHALL contain recognized episode mappings

### Requirement: Unified plan state management
The system SHALL manage both temporary and persistent recognition plans in a single global state array.

#### Scenario: Both plan types in same state
- **WHEN** global state contains both temporary and persistent plans
- **THEN** pendingPlans array SHALL include plans with `tmp: true`
- **AND** pendingPlans array SHALL include plans with `tmp: false`
- **AND** system SHALL distinguish between plan types using the `tmp` property

#### Scenario: Temporary plan cleanup on media folder change
- **WHEN** user switches to a different media folder
- **THEN** system SHALL remove all temporary plans from previous folder
- **AND** system SHALL retain persistent AI-based plans for previous folder

### Requirement: Prompt selection based on plan type
The system SHALL display the appropriate recognition prompt based on the `tmp` property of pending plans.

#### Scenario: Display rule-based prompt for temporary plan
- **WHEN** a temporary plan (tmp: true) is detected in pendingPlans
- **THEN** system SHALL open the rule-based recognition prompt
- **AND** system SHALL build preview seasons from the plan
- **AND** system SHALL allow user to confirm or cancel the recognition

#### Scenario: Display AI-based prompt for persistent plan
- **WHEN** a persistent plan (tmp: false) is detected in pendingPlans
- **THEN** system SHALL open the AI-based recognition prompt
- **AND** system SHALL display the AI-generated recognition results
- **AND** system SHALL require backend API call on confirmation

### Requirement: Conditional plan update logic
The system SHALL handle plan updates differently based on the `tmp` property.

#### Scenario: Update temporary plan
- **WHEN** user confirms or cancels a temporary plan (tmp: true)
- **THEN** system SHALL remove the plan from local state
- **AND** system SHALL NOT call backend API
- **AND** system SHALL complete the recognition operation locally

#### Scenario: Update persistent plan
- **WHEN** user confirms or cancels a persistent plan (tmp: false)
- **THEN** system SHALL call backend API with plan status update
- **AND** system SHALL remove the plan from local state after successful API call
- **AND** system SHALL display error message if API call fails

#### Scenario: Handle API failure for persistent plan
- **WHEN** backend API call fails during persistent plan update
- **THEN** system SHALL display error toast to user
- **AND** system SHALL refetch pending plans from backend
- **AND** system SHALL re-add the failed plan to local state if still pending

### Requirement: Temporary plan lifecycle
The system SHALL ensure temporary plans have a well-defined lifecycle from creation to cleanup.

#### Scenario: Temporary plan removed after confirmation
- **WHEN** user confirms a temporary recognition plan
- **THEN** system SHALL apply the recognition changes to media metadata
- **AND** system SHALL remove the temporary plan from pendingPlans
- **AND** system SHALL close the recognition prompt

#### Scenario: Temporary plan removed after cancellation
- **WHEN** user cancels a temporary recognition plan
- **THEN** system SHALL remove the temporary plan from pendingPlans
- **AND** system SHALL close the recognition prompt
- **AND** system SHALL NOT modify media metadata

#### Scenario: Orphaned temporary plan cleanup
- **WHEN** a temporary plan exists but is no longer relevant (e.g., media folder changed)
- **THEN** system SHALL automatically remove the orphaned plan
- **AND** system SHALL close any open prompts for the orphaned plan
