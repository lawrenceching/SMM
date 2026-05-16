## Purpose

Define the HTTP API that runs **VideoCaptioner** `synthesize` (mux or burn subtitles into video) and returns structured success or failure.
## Requirements
### Requirement: VideoCaptioner synthesize via executeCmd

The system SHALL trigger VideoCaptioner synthesis by invoking **`POST /api/executeCmd`** with `command: "videocaptioner"` and args from the synthesize adapter (`videocaptioner synthesize <videoPath> -s <subtitlePath>` plus optional flags). Validation for required paths and enum fields SHALL occur in the client adapter before executeCmd is called.

#### Scenario: Synthesis completes successfully

- **WHEN** synthesize is invoked with valid video and subtitle paths and exit code is `0`
- **THEN** the caller receives success

#### Scenario: Synthesis fails

- **WHEN** VideoCaptioner exits non-zero or times out
- **THEN** the caller receives an error suitable for job failure UI

