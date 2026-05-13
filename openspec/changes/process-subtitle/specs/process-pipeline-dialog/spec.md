## ADDED Requirements

### Requirement: ProcessPipelineDialog media row listing

The system SHALL provide a **`ProcessPipelineDialog`** (or equivalent smart + UI split) that lists one row per **eligible media file** for the panel that opens it (TV episodes, movie video, or music tracks), each with a stable identifier, display paths or titles, an **`eligible`** flag, and a localized **`disabledReason`** when the row cannot run **`videocaptioner process`** (for example missing resolvable media path or VideoCaptioner unavailable).

#### Scenario: TV show rows derive from media files

- **WHEN** the dialog opens from **TvShowPanel** with `MediaMetadata.mediaFiles` containing entries with resolvable media paths suitable for **Transcribe**
- **THEN** the dialog lists one row per eligible media file used for the full pipeline
- **AND** ineligible entries are listed with localized hints and are not selectable by default

#### Scenario: Movie row derives from the movie video file

- **WHEN** the dialog opens from **MoviePanel** with a resolvable movie video path
- **THEN** the dialog lists at least one row for that video when eligible
- **AND** when no resolvable video exists, the dialog lists ineligible state with a localized hint

#### Scenario: Music rows derive from tracks with resolvable paths

- **WHEN** the dialog opens from **MusicPanel** with tracks that have resolvable file paths suitable for transcription
- **THEN** the dialog lists eligible rows for those tracks
- **AND** tracks without resolvable paths are ineligible with localized hints

#### Scenario: Default selection excludes ineligible rows

- **WHEN** the dialog opens with a mix of eligible and ineligible rows and no explicit default selection override is provided
- **THEN** every eligible row is selected by default
- **AND** ineligible rows are visible but not selectable

### Requirement: ProcessPipelineDialog pipeline options

The system SHALL expose in **`ProcessPipelineDialog`** the **process** options the product supports in v1, including at minimum: transcribe **ASR** / **language** / **word timestamps** / **output format** (aligned with **`TranscribeDialog`** literals where applicable), subtitle-step toggles (**skip optimize**, **skip translate**, **skip split**) and **translator** / **target language** when translation is enabled, and **no synthesize** plus synthesize options (**subtitle mode**, **quality**, **style**, **render mode**, **layout**) when synthesis is enabled. The dialog SHALL persist user-chosen defaults to **`localStorage`** on successful confirm where consistent with existing transcribe/translate dialogs.

#### Scenario: Confirm builds job payload per selected eligible row

- **WHEN** the user confirms with one or more eligible rows selected
- **THEN** the smart dialog enqueues one **`process`** background job per selected eligible row with media platform paths, chosen options, and display title metadata
- **AND** the dialog closes when at least one job was enqueued

#### Scenario: VideoCaptioner unavailable blocks confirm

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** confirm is disabled or no-ops with clear inline or toast feedback
- **AND** no **process** jobs are enqueued

#### Scenario: ASR choice respects Tencent and key requirements

- **WHEN** the user selects an ASR option that requires Tencent ASR or external API keys that are not satisfied by application configuration
- **THEN** confirm is disabled or validation prevents enqueue with a localized reason
- **AND** no **process** jobs are enqueued until the configuration supports the chosen ASR

### Requirement: ProcessPipelineDialog parity with existing dialog UX patterns

The system SHALL use the same Shadcn/Radix dialog layout patterns as **`TranscribeDialog`** / **`SynthesizeSubtitleDialog`** where practical (title, description, scrollable row list, footer actions). Cancel SHALL close without enqueue.

#### Scenario: Cancel closes without enqueue

- **WHEN** the user activates cancel or dismisses the dialog
- **THEN** no **`process`** jobs are created
