## ADDED Requirements

### Requirement: VideoCaptioner subtitle translation command trigger

The system SHALL provide an API operation that triggers VideoCaptioner subtitle translation for a selected source subtitle file and waits for command completion before returning success/failure outcome. The request SHALL include **`subtitlePath`** (non-empty string), **`translator`** (one of **`bing`**, **`google`**, **`llm`**), and **`targetLanguage`** (non-empty string, BCP-47 code). The request MAY include **`reflect`** as a boolean (only meaningful when **`translator`** is **`llm`**). The request MAY include **`layout`** as one of **`target-above`**, **`source-above`**, **`target-only`**, **`source-only`**. The request MAY include an **`llm`** object with **`apiKey`** (non-empty when present), optional **`apiBase`**, and optional **`model`**. The CLI invocation SHALL run `videocaptioner subtitle <subtitlePath>` and pass `--translator`, `--target-language`, and (when set) `--reflect`, `--layout`, `--api-key`, `--api-base`, `--model`. The invocation SHALL explicitly pass `--no-optimize` and `--no-split` so that only the translation step runs.

#### Scenario: Translation completes successfully

- **WHEN** a user triggers translation for a supported subtitle file and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating translation completed

#### Scenario: Translation completes with failure

- **WHEN** a user triggers translation and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as translation failure
- **AND** the response error message SHALL include a truncated excerpt of stderr (up to 500 characters) when available

#### Scenario: Missing subtitle file rejected

- **WHEN** the translate API is called with a `subtitlePath` that does not exist on disk
- **THEN** the API returns an error response indicating the file was not found

#### Scenario: Missing required fields rejected

- **WHEN** the translate API is called with an empty `subtitlePath`, missing `translator`, or empty `targetLanguage`
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid translator rejected

- **WHEN** the translate API is called with `translator` outside the allowed set (`bing`, `google`, `llm`)
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Invalid layout rejected

- **WHEN** the translate API is called with `layout` outside the allowed set
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: LLM translator requires API key

- **WHEN** the translate API is called with `translator` equal to `llm` and the `llm` object is omitted or has an empty `apiKey`
- **THEN** the API returns a client error response indicating that LLM credentials are required

#### Scenario: VideoCaptioner executable unavailable

- **WHEN** the translate API is called while no VideoCaptioner executable can be discovered
- **THEN** the API returns an error response indicating that the executable is unavailable

#### Scenario: Translation respects shared timeout

- **WHEN** the underlying `videocaptioner subtitle` invocation does not complete within the configured timeout
- **THEN** the API kills the process and returns an error response indicating a timeout
