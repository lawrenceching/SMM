## ADDED Requirements

### Requirement: VideoCaptioner process pipeline via executeCmd

The system SHALL trigger **`videocaptioner process`** through **`POST /api/executeCmd`** using the process adapter, accepting the same logical request fields as the former process API (`mediaPath`, transcribe/subtitle/synthesize options, `noSynthesize`). The client SHALL apply validation equivalent to the removed route and SHALL use timeout headers appropriate for long-running process jobs.

#### Scenario: Process completes successfully

- **WHEN** process is invoked for a valid `mediaPath` and exits `0`
- **THEN** the caller receives success

#### Scenario: Process fails

- **WHEN** VideoCaptioner exits non-zero within the configured timeout
- **THEN** the caller receives failure with stderr excerpt when available

## REMOVED Requirements

### Requirement: VideoCaptioner process command trigger

**Reason**: `POST /api/videocaptioner/process` removed.

**Migration**: Process background jobs call executeCmd via shared adapter.
