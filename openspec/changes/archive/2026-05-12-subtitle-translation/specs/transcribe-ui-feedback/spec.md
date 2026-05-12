## ADDED Requirements

### Requirement: Translate background job lifecycle feedback

The system SHALL create and maintain a translate background job lifecycle in the UI when a user confirms `SubtitleTranslationDialog` from any panel, including multi-file queue execution semantics that mirror the existing transcribe lifecycle.

#### Scenario: Create pending jobs when confirming dialog with multiple rows

- **WHEN** a user confirms `SubtitleTranslationDialog` with multiple eligible rows selected
- **THEN** the UI creates one `translate` background job entry per selected eligible row
- **AND** each created entry starts in `pending` state

#### Scenario: Start only one pending translate job at a time

- **WHEN** there is at least one `pending` `translate` job and no `running` `translate` job in the current batch
- **THEN** the UI transitions exactly one pending `translate` job to `running`
- **AND** all other jobs in the batch remain `pending`

#### Scenario: Mark translate job succeeded on completed success

- **WHEN** the translate API returns a completed success result for the running `translate` job
- **THEN** the matching background job is updated to `succeeded` state

#### Scenario: Mark translate job failed on completed error

- **WHEN** the translate API returns a completed failure result or request error for the running `translate` job
- **THEN** the matching background job is updated to `failed` state

#### Scenario: Continue with next pending translate job after terminal result

- **WHEN** the current running `translate` job transitions to `succeeded` or `failed` and another `translate` job in the same batch is still `pending`
- **THEN** the UI starts the next pending `translate` job
- **AND** `translate` requests for jobs in the batch remain non-concurrent

### Requirement: Translate toast sequence

The system SHALL surface both start and completion feedback toasts for a translate request.

#### Scenario: Show start toast immediately

- **WHEN** a translate job starts after the user confirms `SubtitleTranslationDialog` with at least one selected eligible row (from `TvShowPanel`, `MoviePanel`, or `MusicPanel`)
- **THEN** the UI immediately shows a `Translate start` toast before API completion for that job

#### Scenario: Show completion success toast

- **WHEN** the translate API returns a completed success result
- **THEN** the UI shows a success toast indicating translation completed

#### Scenario: Show completion failure toast

- **WHEN** the translate API returns a completed failure result
- **THEN** the UI shows a failure toast indicating translation failed

### Requirement: Translate action is disabled when VideoCaptioner is unavailable

The system SHALL disable the **Translate** action in panel headers and the `MusicFileTable` context menu `Subtitle` submenu when VideoCaptioner discovery reports unavailable.

#### Scenario: Translate disabled when VideoCaptioner is unavailable

- **WHEN** a user opens the panel header **Subtitle** menu or a row's context menu **Subtitle** submenu while VideoCaptioner discovery state is unavailable
- **THEN** the **Translate** menu item is shown as disabled
- **AND** selecting the disabled item does not open `SubtitleTranslationDialog` or enqueue any translate background job

#### Scenario: Translate enabled when VideoCaptioner is available

- **WHEN** a user opens the panel header **Subtitle** menu or a row's context menu **Subtitle** submenu while VideoCaptioner discovery state is available
- **THEN** the **Translate** menu item is enabled if and only if at least one eligible source subtitle row exists for the panel / row
- **AND** selecting it opens `SubtitleTranslationDialog`

### Requirement: SubtitleTranslationDialog confirmation uses shared background job feedback

The system SHALL apply the same translate background job lifecycle and toast feedback used for `MusicPanel` when the user confirms `SubtitleTranslationDialog` opened from **TvShowPanel**, **MoviePanel**, or **MusicPanel**.

#### Scenario: Confirm creates translate jobs per selected eligible row

- **WHEN** a user confirms `SubtitleTranslationDialog` with multiple eligible rows selected from TV / movie `mediaFiles` subtitle paths, or from `MusicPanel` tracks with sibling subtitle files
- **THEN** the UI creates one `translate` background job per selected eligible row consistent with the multi-file translate semantics defined in this capability
- **AND** start and completion toasts are shown per the translate feedback rules

#### Scenario: Sequential translate execution preserved

- **WHEN** multiple subtitle files are translated from `SubtitleTranslationDialog` (including from `MusicPanel`)
- **THEN** translate requests for that batch remain non-concurrent
