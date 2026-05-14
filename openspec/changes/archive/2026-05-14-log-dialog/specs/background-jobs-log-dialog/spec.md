## ADDED Requirements

### Requirement: Background jobs list exposes log action for subtitle jobs

The system SHALL render an affordance (for example a button with icon and accessible label) on each `BackgroundJobsPopover` row whose `BackgroundJob.type` is one of `transcribe`, `translate`, `synthesize`, or `process` **and** whose `data.executionId` is a non-empty string.

#### Scenario: Log control hidden without execution id

- **WHEN** a subtitle-type job record has no `executionId` in `data`
- **THEN** the log affordance is not shown (or is shown disabled with an explanatory tooltip consistent with product copy)

#### Scenario: Log control visible with execution id

- **WHEN** a subtitle-type job includes `executionId`
- **THEN** the log affordance is visible regardless of job status (`pending`, `running`, `succeeded`, `failed`, `aborted`)

### Requirement: LogDialog opens through DialogProvider

The system SHALL register `LogDialog` with `DialogProvider` and expose `openLogDialog` / `closeLogDialog` (or equivalent tuple) via `useDialogs`, accepting parameters that include at minimum `executionId` and a human-readable title.

#### Scenario: Opening dialog fetches log

- **WHEN** the user activates the log affordance for a job
- **THEN** `LogDialog` opens and triggers a fetch of `/api/command-log/:executionId` using the shared HTTP client conventions (including dev CLI origin handling when applicable)
- **AND** loading, success, empty, not-found, and error states are represented in the dialog body

### Requirement: LogDialog supports inspection workflows

The system SHALL provide within `LogDialog` at least: scrollable log viewport, manual refresh, copy of `executionId`, copy of `logRelativePath` when present, and close actions. Text styling MUST distinguish stdout, stderr, and system sections when `format=segments` is used.

#### Scenario: User copies execution id

- **WHEN** the user activates the copy control for `executionId`
- **THEN** the clipboard receives the exact UUID string shown in the dialog

#### Scenario: Truncated log surfaces hint

- **WHEN** the API indicates truncation via documented headers or JSON fields
- **THEN** the dialog displays a clear message that only part of the log is shown and points the user to refresh or a follow-up download workflow if implemented

### Requirement: Internationalization for log dialog

The system SHALL add translation entries (English, Simplified Chinese, Traditional Chinese Hong Kong, Traditional Chinese Taiwan) for all user-visible strings introduced by `LogDialog` and the background-jobs log affordance, following the namespace conventions used by adjacent Status Bar / dialog strings.

#### Scenario: Locale keys resolve

- **WHEN** the UI renders the log affordance and `LogDialog` in each supported locale
- **THEN** no hard-coded user-visible English string remains except proper nouns (`executionId`, product names) where intentional
