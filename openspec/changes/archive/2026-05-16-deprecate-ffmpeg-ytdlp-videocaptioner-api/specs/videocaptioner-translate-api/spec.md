## ADDED Requirements

### Requirement: VideoCaptioner subtitle translation via executeCmd

The system SHALL trigger VideoCaptioner subtitle translation by invoking **`POST /api/executeCmd`** with `command: "videocaptioner"` and args built by the shared translate adapter. The adapter SHALL accept the same logical fields as the former translate API (`subtitlePath`, `translator`, `targetLanguage`, optional `reflect`, `layout`, `llm`) and SHALL run `videocaptioner subtitle <subtitlePath>` with `--no-optimize` and `--no-split`. The client SHALL validate required fields before calling executeCmd and SHALL surface stderr excerpts on failure.

#### Scenario: Translation completes successfully

- **WHEN** translate is invoked with valid inputs and the process exits with code `0`
- **THEN** the caller receives a success outcome suitable for UI or background-job completion

#### Scenario: Translation fails with stderr

- **WHEN** VideoCaptioner exits non-zero
- **THEN** the caller receives an error string including a truncated stderr excerpt when available

## REMOVED Requirements

### Requirement: VideoCaptioner subtitle translation command trigger

**Reason**: Dedicated `POST /api/videocaptioner/translate` removed in favor of executeCmd client adapters.

**Migration**: Use `buildVideoCaptionerTranslateArgs` (or equivalent) + `executeCmdStream` / stream-to-completion helper from background jobs.
