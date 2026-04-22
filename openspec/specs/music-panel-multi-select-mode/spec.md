# music-panel-multi-select-mode Specification

## Purpose
TBD - created by archiving change multiple-selection-in-music-panel. Update Purpose after archive.
## Requirements
### Requirement: Music header exposes explicit selection mode toggle
The system SHALL provide a mode toggle action in `MusicHeaderV2` that displays `Select` when multi-selection mode is inactive and `Cancel` when multi-selection mode is active.

#### Scenario: Enter selection mode from header
- **WHEN** a user clicks `Select` in `MusicHeaderV2`
- **THEN** the music panel enters multi-selection mode and the header action label changes to `Cancel`

#### Scenario: Exit selection mode from header
- **WHEN** a user clicks `Cancel` in `MusicHeaderV2`
- **THEN** the music panel exits multi-selection mode and the header action label changes back to `Select`

### Requirement: Music file table renders checkbox column only in selection mode
The system SHALL render a checkbox column as the first table column in `MusicFileTable` only while multi-selection mode is active.

#### Scenario: Checkbox column is shown in selection mode
- **WHEN** multi-selection mode is active
- **THEN** each visible row in `MusicFileTable` includes a leading checkbox control

#### Scenario: Checkbox column is hidden outside selection mode
- **WHEN** multi-selection mode is inactive
- **THEN** `MusicFileTable` does not render the checkbox column

### Requirement: Cancelling selection mode clears transient row selection
The system SHALL clear currently selected rows when a user exits selection mode via `Cancel`.

#### Scenario: Selected rows are reset on cancel
- **WHEN** one or more rows are selected and the user clicks `Cancel`
- **THEN** multi-selection mode exits and selected-row state is cleared

