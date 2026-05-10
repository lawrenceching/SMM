## Purpose

Define the HTTP API for Tencent ASR transcription used when **Tencent ASR** is selected in **TranscribeDialog**.

## Requirements

### Requirement: Tencent ASR transcribe HTTP API

The system SHALL provide an API operation that triggers Tencent ASR transcription for a selected local media file using caller-supplied **`baseUrl`** and **`apiKey`**, waits for completion, and returns a success or failure outcome suitable for the existing transcribe UI feedback pipeline.

#### Scenario: Request includes required fields

- **WHEN** the API receives a JSON body with non-empty **`mediaPath`**, **`baseUrl`**, and **`apiKey`**
- **THEN** the system resolves the media file from **`mediaPath`** and performs the Tencent ASR HTTP integration against **`baseUrl`** using **`apiKey`** for authentication as defined by the implementation

#### Scenario: Success response

- **WHEN** Tencent ASR completes successfully for the request
- **THEN** the API returns a success response consistent with other transcribe operations (so the UI can mark the job succeeded)

#### Scenario: Missing or invalid credentials rejected

- **WHEN** **`baseUrl`** or **`apiKey`** is missing, empty after trim, or fails server-side URL validation
- **THEN** the API returns a client error response indicating invalid input

#### Scenario: Tencent or transport failure

- **WHEN** the Tencent ASR call fails or returns an error status the implementation treats as failure
- **THEN** the API returns an error response that can be surfaced to the user as transcription failure
