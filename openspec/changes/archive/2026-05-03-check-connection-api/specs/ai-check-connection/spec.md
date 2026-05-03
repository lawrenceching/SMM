## ADDED Requirements

### Requirement: Check AI provider connectivity

The system SHALL provide an HTTP endpoint `POST /api/ai/check` that tests connectivity to a specified AI provider using the Vercel AI SDK's `generateText` function.

#### Scenario: Successful connectivity check

- **WHEN** the client sends `POST /api/ai/check` with `{ "ai": "DeepSeek", "model": "deepseek-chat", "apiKey": "sk-valid" }` and the AI provider responds successfully to a "hello" message
- **THEN** the response has HTTP status 200
- **AND** the response body is `{ "ai": "DeepSeek", "model": "deepseek-chat", "status": "ok" }`

#### Scenario: Provider returns an error

- **WHEN** the client sends `POST /api/ai/check` with valid AI type and model but an invalid or expired API key
- **THEN** the response has HTTP status 200
- **AND** the response body is `{ "ai": "<type>", "model": "<model>", "status": "error" }`

#### Scenario: Missing required fields

- **WHEN** the client sends `POST /api/ai/check` with a body missing the `ai` field
- **THEN** the response has HTTP status 400
- **AND** the response body contains an error message indicating which field is missing

#### Scenario: No saved baseURL for the specified AI type

- **WHEN** the client sends `POST /api/ai/check` with an `ai` type that has no corresponding `baseURL` in the user config
- **THEN** the response has HTTP status 400
- **AND** the response body contains an error message indicating the baseURL is missing for that AI type
