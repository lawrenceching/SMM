## Purpose

Define **`SynthesizeSubtitleDialog`** rows, options, persistence, and confirmation behavior for subtitle-to-video synthesis across TV, movie, and music panels.

## Requirements

### Requirement: SynthesizeSubtitleDialog video-and-subtitle row listing

The system SHALL provide a **`SynthesizeSubtitleDialog`** component that lists one row per candidate **(video file, subtitle file)** pair derived from the panel that opens it. Each row SHALL expose a stable identifier, display paths where helpful, an optional title (episode / movie / track), an **`eligible`** flag, and a localized **`disabledReason`** when the pair cannot be synthesized (for example missing video, missing subtitle, or non-video track on **Music**).

#### Scenario: TV show rows derive from media files with video and subtitle paths

- **WHEN** the dialog opens from **TvShowPanel** with `MediaMetadata.mediaFiles` containing entries that have both a resolvable video path and at least one `subtitleFilePaths` entry
- **THEN** the dialog lists one row per appropriate **(video, subtitle)** pairing consistent with metadata
- **AND** media entries without both a video path and a subtitle path produce ineligible rows with a localized hint

#### Scenario: Movie rows derive from the movie video and its subtitles

- **WHEN** the dialog opens from **MoviePanel** with the movie video file and at least one subtitle path
- **THEN** the dialog lists eligible rows for each synthesizable pair
- **AND** when the movie has no subtitle paths, at least one ineligible row is listed with a localized hint

#### Scenario: Music rows derive only for video tracks with sibling subtitles

- **WHEN** the dialog opens from **MusicPanel** with a track whose resolved file is a supported **video** container and has a resolvable sibling subtitle (for example `.srt` / `.ass`)
- **THEN** the dialog lists eligible rows for those pairs
- **AND** audio-only or unsupported-container tracks are listed as ineligible with a localized hint

#### Scenario: Default selection excludes ineligible rows

- **WHEN** the dialog opens with a mix of eligible and ineligible rows and no explicit default selection override is provided
- **THEN** every eligible row is selected by default
- **AND** ineligible rows are visible but not selectable

### Requirement: SynthesizeSubtitleDialog synthesis options

The system SHALL expose synthesis options in **`SynthesizeSubtitleDialog`** for **`subtitleMode`** (**`soft`** / **`hard`**), **`quality`** (**`ultra`** / **`high`** / **`medium`** / **`low`**), optional **`style`** (preset name string), and optional **`renderMode`** (**`ass`** / **`rounded`**), with defaults aligned to VideoCaptioner CLI defaults. The dialog SHALL persist user-chosen defaults (for example **`subtitleMode`** and **`quality`**) to **`localStorage`** on successful confirm so repeat visits reuse the last choices.

#### Scenario: Confirm builds job payload per selected eligible row

- **WHEN** the user confirms with one or more eligible rows selected
- **THEN** the smart dialog enqueues one **`synthesize`** background job per selected eligible row with video path, subtitle path, platform paths, chosen options, and display title metadata
- **AND** the dialog closes when at least one job was enqueued

#### Scenario: VideoCaptioner unavailable blocks confirm

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** confirm is disabled or no-ops with clear inline or toast feedback
- **AND** no synthesize jobs are enqueued

### Requirement: SynthesizeSubtitleDialog parity with existing dialog UX patterns

The system SHALL use the same Shadcn/Radix dialog layout patterns as **`SubtitleTranslationDialog`** where practical (title, description, scrollable row list, footer actions), and SHALL prevent confirm when no eligible row is selected or when **LLM**-style blocking rules do not apply (N/A for synthesize) while still validating required option combinations if the CLI requires them.

#### Scenario: Cancel closes without enqueue

- **WHEN** the user activates cancel or dismisses the dialog
- **THEN** no **`synthesize`** jobs are created
