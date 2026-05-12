## ADDED Requirements

### Requirement: VideoCaptioner synthesize command trigger

The system SHALL provide an API operation that triggers **VideoCaptioner** synthesis (mux or burn subtitles into a video) for a selected **video** file and **subtitle** file and waits for command completion before returning success/failure outcome. The request SHALL include **`videoPath`** (non-empty string, platform path to an existing video file) and **`subtitlePath`** (non-empty string, platform path to an existing subtitle file). The request MAY include **`subtitleMode`** as **`soft`** or **`hard`**; when omitted, the system SHALL match VideoCaptioner CLI default behavior. The request MAY include **`quality`** as one of **`ultra`**, **`high`**, **`medium`**, **`low`**. The request MAY include **`style`** as a non-empty string (preset name). The request MAY include **`renderMode`** as **`ass`** or **`rounded`**. The request MAY include **`layout`** when the CLI supports a layout flag for synthesize. The CLI invocation SHALL run **`videocaptioner synthesize <videoPath> -s <subtitlePath>`** and pass supported optional flags consistently with the installed VideoCaptioner CLI. The invocation SHALL use the same executable discovery, environment preparation (including optional bundled FFmpeg PATH), timeout policy, and stderr truncation rules as existing VideoCaptioner **`transcribe`** and **`subtitle` (translate)** integrations.

#### Scenario: Synthesis completes successfully

- **WHEN** a user triggers synthesize for valid video and subtitle paths and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating synthesis completed

#### Scenario: Synthesis completes with failure

- **WHEN** synthesize is triggered and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as synthesis failure
- **AND** the response error message SHALL include a truncated excerpt of stderr (up to 500 characters) when available

#### Scenario: Missing video or subtitle file rejected

- **WHEN** the API is called with a `videoPath` or `subtitlePath` that does not exist on disk
- **THEN** the API returns an error response indicating the file was not found

#### Scenario: Missing required fields rejected

- **WHEN** the API is called with an empty `videoPath` or empty `subtitlePath`
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid subtitleMode rejected

- **WHEN** the API is called with `subtitleMode` outside the allowed set
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid quality rejected

- **WHEN** the API is called with `quality` outside the allowed set
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid renderMode rejected

- **WHEN** the API is called with `renderMode` outside the allowed set
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: VideoCaptioner executable unavailable

- **WHEN** the API is called while no VideoCaptioner executable can be discovered
- **THEN** the API returns an error response indicating that the executable is unavailable

#### Scenario: Synthesis respects configured timeout

- **WHEN** the underlying `videocaptioner synthesize` invocation does not complete within the configured timeout for this operation
- **THEN** the API kills the process and returns an error response indicating a timeout
