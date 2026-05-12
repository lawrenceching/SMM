## Purpose

Define how **MusicPanel** exposes per-row **translate** job state in **`MusicFileTable`** (row shape, title-cell indicators, and **Stop translate** in the **Subtitle** context submenu).

## Requirements

### Requirement: MusicFileRow exposes translate status

The system SHALL extend the `MusicFileRow` shape with a `translateStatus` field of type `'running' | 'failed' | undefined`, sourced from `useTranslateManager.translatingPaths` and `translateFailedPaths` matched by the row's POSIX absolute file path.

#### Scenario: Running translate maps to row state

- **WHEN** a `translate` job with `status === 'running'` exists whose data resolves to the row's POSIX media path
- **THEN** the row's `translateStatus` is `'running'`

#### Scenario: Failed translate maps to row state

- **WHEN** the most recent translate job for the row's POSIX media path has `status === 'failed'`
- **AND** no `running` translate job exists for the same path
- **THEN** the row's `translateStatus` is `'failed'`

#### Scenario: No translate state

- **WHEN** no `translate` job exists for the row's POSIX media path
- **THEN** the row's `translateStatus` is `undefined`

#### Scenario: Coexists with transcribe status

- **WHEN** both a `running` transcribe job and a `running` translate job exist for the same row
- **THEN** the row exposes both `transcribeStatus === 'running'` and `translateStatus === 'running'`

### Requirement: MusicFileTable renders translate status indicators

The system SHALL render in the `MusicFileTable` title cell a distinct visual indicator for the translate job state (spinner when `running`, error badge when `failed`), visually distinguishable from the transcribe indicator, with a localized tooltip.

#### Scenario: Running translate shows spinner with tooltip

- **WHEN** a row has `translateStatus === 'running'`
- **THEN** a spinner icon is rendered in the title cell next to (or after) the transcribe indicator
- **AND** hovering the spinner reveals a localized tooltip indicating translation is in progress

#### Scenario: Failed translate shows failure badge with tooltip

- **WHEN** a row has `translateStatus === 'failed'`
- **AND** the row does not also have `translateStatus === 'running'`
- **THEN** a failure indicator icon is rendered in the title cell
- **AND** hovering the indicator reveals a localized tooltip explaining that translation failed

#### Scenario: Both indicators render simultaneously

- **WHEN** a row has both `transcribeStatus === 'running'` and `translateStatus === 'running'`
- **THEN** both indicators render concurrently and remain visually distinct

### Requirement: MusicFileTable row context menu Stop translate action

The system SHALL surface a **Stop translate** item in the row context menu's **Subtitle** submenu when a `translate` job is currently `running` for that row, and invoking it SHALL stop the underlying job.

#### Scenario: Stop translate visible only when running

- **WHEN** a row has `translateStatus === 'running'`
- **THEN** the **Subtitle** submenu of that row shows a **Stop translate** item
- **AND** when the row does not have `translateStatus === 'running'`, the **Stop translate** item is not shown

#### Scenario: Stop translate invokes job manager

- **WHEN** the user activates **Stop translate** for a row
- **THEN** the panel calls `stopTranslate(jobId)` for the job currently associated with this row's media path
- **AND** the row's `translateStatus` transitions away from `'running'` once the service worker confirms the stop
