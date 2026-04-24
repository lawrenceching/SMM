## MODIFIED Requirements

### Requirement: Persist selected sidebar directory

The system SHALL persist the currently selected sidebar directory identifier to client localStorage whenever the user changes directory selection.

#### Scenario: Selection change triggers persistence

- **WHEN** a user selects a different directory in the sidebar
- **THEN** the system stores the selected directory identifier in localStorage

#### Scenario: Re-selecting same directory does not duplicate writes

- **WHEN** a user selects the directory that is already selected
- **THEN** the system does not perform an additional persistence write for unchanged selection

### Requirement: Restore selected sidebar directory on app startup

The system SHALL restore the previously persisted sidebar directory selection from localStorage when the application launches and directory data has loaded.

#### Scenario: Persisted directory exists

- **WHEN** the app starts and the persisted directory identifier matches a loaded sidebar directory
- **THEN** that directory is selected automatically

#### Scenario: Persisted directory missing or invalid

- **WHEN** the app starts and the persisted directory identifier cannot be resolved to a loaded sidebar directory
- **THEN** the system falls back to the default selection behavior without blocking app startup

### Requirement: Persisted selection survives relaunch

The system SHALL keep sidebar directory selection consistent across application restarts using localStorage-backed persistence.

#### Scenario: Relaunch restores last selection

- **WHEN** a user selects a sidebar directory, closes the app, and opens it again
- **THEN** the sidebar shows the same directory as selected after relaunch
