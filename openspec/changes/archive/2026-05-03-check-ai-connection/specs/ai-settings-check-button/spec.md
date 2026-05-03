## ADDED Requirements

### Requirement: Check button tests AI provider connectivity

The AI settings panel SHALL provide a "Check" button that sends the current form values to `POST /api/ai/check` and displays the connection result.

#### Scenario: Successful connection check

- **WHEN** the user clicks "Check" with valid baseURL, apiKey, and model filled in for the selected provider
- **AND** the backend responds with `{ "ai": "...", "model": "...", "status": "ok" }`
- **THEN** a success indicator is displayed showing the connection is working

#### Scenario: Failed connection check

- **WHEN** the user clicks "Check" with an invalid or expired apiKey
- **AND** the backend responds with `{ "ai": "...", "model": "...", "status": "error" }`
- **THEN** an error message is displayed indicating the connection failed

#### Scenario: Button disabled during check

- **WHEN** the user clicks "Check"
- **THEN** the button is disabled and shows a loading state while the request is in progress
- **AND** the button becomes enabled again after the response is received

#### Scenario: Check uses unsaved form values

- **WHEN** the user edits the apiKey or model fields but has not saved
- **AND** clicks "Check"
- **THEN** the check uses the current unsaved form values, not the persisted config

#### Scenario: Check result is ephemeral

- **WHEN** the user switches to a different AI provider and switches back
- **THEN** any previous check result for that provider is cleared
