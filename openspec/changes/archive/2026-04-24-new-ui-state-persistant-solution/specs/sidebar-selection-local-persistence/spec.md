## ADDED Requirements

### Requirement: Persist selected sidebar folder in localStorage
The UI SHALL persist the current sidebar selected folder identifier to localStorage when selection changes to a different resolved folder.

#### Scenario: Selection change writes to localStorage
- **WHEN** a user selects a different sidebar folder and the folder is resolvable in current UI state
- **THEN** the UI writes the normalized folder identifier to the configured localStorage key

#### Scenario: Unchanged selection does not rewrite localStorage
- **WHEN** selection events occur but the selected folder identifier is unchanged
- **THEN** the UI does not perform an additional localStorage write

### Requirement: Restore selected sidebar folder from localStorage
The UI SHALL restore sidebar selection from localStorage after folder data hydration and identity reconciliation.

#### Scenario: Stored selection is resolvable
- **WHEN** startup hydration completes and localStorage contains a folder identifier present in current folder list
- **THEN** that folder becomes the active sidebar selection

#### Scenario: Stored selection is stale or missing
- **WHEN** startup hydration completes and localStorage value is absent or not present in current folder list
- **THEN** the UI falls back to default selection behavior without blocking startup
