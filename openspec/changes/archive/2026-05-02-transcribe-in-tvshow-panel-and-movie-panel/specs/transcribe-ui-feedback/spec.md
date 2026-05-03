## ADDED Requirements

### Requirement: TranscribeDialog confirmation uses shared background job feedback

The system SHALL apply the same transcribe background job lifecycle and toast feedback used for **MusicPanel** when the user confirms **`TranscribeDialog`** opened from **TvShowPanel** or **MoviePanel**.

#### Scenario: Confirm creates jobs per selected file

- **WHEN** a user confirms **`TranscribeDialog`** with multiple rows selected from TV or movie **`mediaFiles`**
- **THEN** the UI creates one transcribe background job per selected file consistent with existing multi-file transcribe semantics
- **AND** start and completion toasts are shown per existing transcribe feedback rules

#### Scenario: Sequential execution preserved

- **WHEN** multiple files are transcribed from **`TranscribeDialog`**
- **THEN** transcribe requests for that batch remain non-concurrent as in the existing queue semantics
