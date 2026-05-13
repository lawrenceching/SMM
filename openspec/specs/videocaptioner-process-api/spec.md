## Purpose

Define the HTTP API for **`videocaptioner process`**: request body, validation, success/failure responses, and operational constraints.

## Requirements

### Requirement: VideoCaptioner process command trigger

The system SHALL provide an API operation that triggers **`videocaptioner process`** for a selected **media** file (video or audio) and waits for command completion before returning success or failure. The request SHALL include **`mediaPath`** (non-empty string, platform path to an existing file). The request MAY include **transcribe** options that map to the existing transcribe API literals (**`asr`**, **`language`**, **`wordTimestamps`**, **`format`**) where supported by the **`process`** subcommand. The request MAY include **subtitle** options supported in v1 (**`translator`**, **`targetLanguage`**, **`noOptimize`**, **`noTranslate`**, **`noSplit`**, **`reflect`**, **`layout`**, **`prompt`**) with validation consistent with VideoCaptioner CLI. The request MAY include **`noSynthesize`** as a boolean mirroring **`--no-synthesize`**. The request MAY include **synthesize** options (**`subtitleMode`**, **`quality`**, **`style`**, **`renderMode`**, **`layout`**) when synthesis is not skipped. The CLI invocation SHALL run **`videocaptioner process <mediaPath>`** with flags derived from the request body and the installed CLI. The invocation SHALL use the same executable discovery, environment preparation (including optional bundled FFmpeg PATH), dedicated **`PROCESS_TIMEOUT_MS`** timeout (not shorter than transcribe-only timeout), and stderr truncation rules as existing VideoCaptioner **`transcribe`**, **`subtitle` (translate)**, and **`synthesize`** integrations.

#### Scenario: Process completes successfully

- **WHEN** a user triggers **process** for a valid `mediaPath` and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating the pipeline completed

#### Scenario: Process completes with failure

- **WHEN** **process** is triggered and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as pipeline failure
- **AND** the response error message SHALL include a truncated excerpt of stderr (up to 500 characters) when available

#### Scenario: Missing media file rejected

- **WHEN** the API is called with a `mediaPath` that does not exist on disk
- **THEN** the API returns an error response indicating the file was not found

#### Scenario: Missing required fields rejected

- **WHEN** the API is called with an empty `mediaPath`
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid transcribe options rejected

- **WHEN** the API is called with `asr`, `format`, or other transcribe fields outside the allowed sets supported by this endpoint
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid subtitle or synthesize options rejected

- **WHEN** the API is called with translator, layout, `subtitleMode`, `quality`, `renderMode`, or other validated fields outside allowed sets
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: VideoCaptioner executable unavailable

- **WHEN** the API is called while no VideoCaptioner executable can be discovered
- **THEN** the API returns an error response indicating that the executable is unavailable

#### Scenario: Process respects configured timeout

- **WHEN** the underlying `videocaptioner process` invocation does not complete within **`PROCESS_TIMEOUT_MS`**
- **THEN** the API kills the process and returns an error response indicating a timeout
