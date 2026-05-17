# text-dialog

Reusable multiline text entry dialog for paste-style input (e.g. yt-dlp cookie files).

## Requirements

### Requirement: Multiline text entry dialog

The system SHALL provide a **TextDialog** component for editing arbitrary multiline text. The dialog SHALL expose a text area, a primary confirm action, and a cancel action. The confirm action SHALL return the current text to the caller; cancel SHALL close without applying changes.

#### Scenario: User confirms edited text

- **WHEN** the caller opens TextDialog with initial text and the user edits the content and confirms
- **THEN** the dialog SHALL invoke the caller's confirm callback with the final trimmed-preserving text value
- **AND** the dialog SHALL close

#### Scenario: User cancels

- **WHEN** the user dismisses TextDialog via cancel or close
- **THEN** the dialog SHALL close without invoking the confirm callback
- **AND** the caller's prior text state SHALL remain unchanged

#### Scenario: Dialog provider integration

- **WHEN** application code requests text input through the dialog provider
- **THEN** TextDialog SHALL render above other content with title and description supplied by the caller
- **AND** only one TextDialog instance SHALL be modal at a time
