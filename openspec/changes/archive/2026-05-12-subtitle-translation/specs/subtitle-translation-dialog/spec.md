## ADDED Requirements

### Requirement: SubtitleTranslationDialog source-subtitle row listing

The system SHALL provide a `SubtitleTranslationDialog` component that lists one row per candidate **source subtitle file**, derived from the panel that opens it. Each row SHALL expose a stable identifier (the POSIX absolute path of the source subtitle file), a display path (relative to the media folder when possible), an optional title (TV episode / movie / track name), and an `eligible` flag with localized `disabledReason` when the source media has no resolvable subtitle file.

#### Scenario: TV show rows derive from media-file subtitle paths

- **WHEN** the dialog opens from **TvShowPanel** with `MediaMetadata.mediaFiles` containing at least one entry whose `subtitleFilePaths` is non-empty
- **THEN** the dialog lists one row per `subtitleFilePaths` entry, grouped under each media file's episode title
- **AND** each row's `path` is the POSIX absolute path of that subtitle file
- **AND** rows whose source media file has no `subtitleFilePaths` are listed but marked ineligible with a localized hint

#### Scenario: Movie rows derive from movie subtitle paths

- **WHEN** the dialog opens from **MoviePanel** with `MediaMetadata.mediaFiles` containing the movie video file and at least one `subtitleFilePaths` entry
- **THEN** the dialog lists at least one row for the movie's subtitle file(s)
- **AND** if the movie file has no `subtitleFilePaths`, a single ineligible row is listed with a hint that no subtitle was found

#### Scenario: Music rows derive from sibling subtitle files

- **WHEN** the dialog opens from **MusicPanel** with at least one track that has a resolvable subtitle sibling (e.g. `<name>.srt` or `<name>.ass` next to the audio file)
- **THEN** the dialog lists one row per such sibling subtitle
- **AND** tracks without a resolvable sibling subtitle are listed but marked ineligible

#### Scenario: Default selection excludes ineligible rows

- **WHEN** the dialog opens with a mix of eligible and ineligible rows and no explicit `defaultSelectedIds` is provided
- **THEN** every eligible row is selected by default
- **AND** ineligible rows are visible but not selectable

### Requirement: SubtitleTranslationDialog translator selection

The system SHALL display a **Translator** selector in `SubtitleTranslationDialog` with exactly **`bing`**, **`google`**, and **`llm`**, defaulting to **`bing`**. The dialog SHALL also expose a **Target language** input that accepts BCP-47 codes (for example `zh-Hans`, `en`, `ja`, `ko`, `fr`, `de`).

#### Scenario: Default translator and target language

- **WHEN** `SubtitleTranslationDialog` opens for the first time in a session and no persisted preference is present
- **THEN** **Translator** defaults to **`bing`**
- **AND** **Target language** defaults to **`zh-Hans`**

#### Scenario: Persisted translator and target language

- **WHEN** `SubtitleTranslationDialog` opens after a previous confirmation set `subtitleTranslation.translator` and `subtitleTranslation.targetLanguage` in `localStorage`
- **THEN** the dialog opens with those persisted values pre-selected

#### Scenario: LLM-only options shown conditionally

- **WHEN** **Translator** is set to **`llm`**
- **THEN** the UI shows additional inputs **API Key**, **API Base** (optional), **Model** (optional), and a **Reflect** toggle
- **AND** when **Translator** is **`bing`** or **`google`**, those LLM-only inputs are not shown

#### Scenario: LLM confirm requires API key

- **WHEN** **Translator** is **`llm`** and **API Key** is empty (after trim)
- **THEN** the user cannot successfully confirm the dialog (confirm disabled or validation prevents enqueue)

#### Scenario: Empty target language blocks confirm

- **WHEN** **Target language** is empty (after trim)
- **THEN** the user cannot successfully confirm the dialog regardless of translator choice

### Requirement: SubtitleTranslationDialog confirmation enqueues translate jobs

The system SHALL enqueue one `translate` background job per selected eligible row when the user confirms `SubtitleTranslationDialog`. Each job SHALL include the **source subtitle path** (POSIX and platform), the selected **translator**, the **target language**, optional **reflect**, optional **llm** credentials, optional **layout**, the originating media folder, an optional **mediaPath** (POSIX and platform) for row-status mapping, and a human-readable **title**.

#### Scenario: Confirm with multiple eligible rows enqueues jobs

- **WHEN** the user confirms `SubtitleTranslationDialog` with multiple eligible rows selected
- **THEN** the UI creates one `translate` job entry per selected eligible row in `pending` state
- **AND** the dialog closes after enqueue

#### Scenario: Confirm without an enqueable folder fails closed

- **WHEN** the user confirms the dialog while the originating media folder is empty or unavailable
- **THEN** the UI does not create any `translate` jobs
- **AND** a clear error toast is shown explaining that the media folder is not available

#### Scenario: Ineligible rows are skipped on confirm

- **WHEN** the user confirms the dialog with one or more ineligible rows somehow included in the selection
- **THEN** the UI skips ineligible rows and only enqueues jobs for eligible ones

### Requirement: SubtitleTranslationDialog disabled when VideoCaptioner is unavailable

The system SHALL prevent successful confirmation of `SubtitleTranslationDialog` when VideoCaptioner discovery reports unavailable, since VideoCaptioner is the only supported translation backend.

#### Scenario: VideoCaptioner unavailable

- **WHEN** `SubtitleTranslationDialog` is opened (or attempted to be opened) while VideoCaptioner discovery reports unavailable
- **THEN** the dialog either is not opened by its callers (preferred) or, if opened, surfaces a disabled-confirm state with a clear hint that VideoCaptioner is required
