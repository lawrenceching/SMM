## ADDED Requirements

### Requirement: Music panel supports explicit multi-select mode in file table interactions
The system SHALL allow `MusicPanel` to orchestrate an explicit multi-select mode for `MusicFileTable` interactions, with mode transitions initiated by `MusicHeaderV2`.

#### Scenario: Header and table mode states stay synchronized
- **WHEN** a user toggles `Select` or `Cancel` from `MusicHeaderV2`
- **THEN** `MusicPanel` updates mode state and `MusicFileTable` reflects the matching selection-mode rendering state
