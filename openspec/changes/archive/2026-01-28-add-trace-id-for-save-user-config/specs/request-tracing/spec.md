## ADDED Requirements

### Requirement: Generate unique trace ID at request origin

The system SHALL generate a unique trace identifier when initiating a user configuration save operation. The trace ID MUST use the format `{event_name}-{counter}` where `event_name` identifies the source component and `counter` is an integer from the `nextTraceId()` utility.

#### Scenario: Trace ID generated on config save
- **WHEN** user triggers configuration save operation (e.g., saving AI settings, general settings, or adding a media folder)
- **THEN** system generates a unique trace ID using `{event_name}-${nextTraceId()}` format
- **AND** counter is generated using `nextTraceId()` utility from `@/lib/utils`
- **AND** trace ID is a string like `AiSettings-1241`, `GeneralSettings-1322`, or `MediaFolderListItem-1456`
- **AND** counter is persisted in localStorage and increments on each call

#### Scenario: Trace ID is unique across concurrent requests
- **WHEN** multiple configuration save operations occur simultaneously
- **THEN** each operation receives a different trace ID
- **AND** no two trace ID counters collide in the same session

#### Scenario: Trace ID has runtime fallback if localStorage fails
- **WHEN** localStorage is unavailable or throws an error
- **THEN** `nextTraceId()` falls back to runtime counter
- **AND** trace ID counter continues to increment uniquely within the page session

#### Scenario: Trace ID format matches documented standard
- **WHEN** trace ID is generated in any UI component
- **THEN** format follows `{event_name}-${nextTraceId()}` pattern
- **AND** format matches standard documented in `docs/trace-id.md`
- **AND** `event_name` is typically the component name or function name (e.g., `AiSettings`, `GeneralSettings`)
- **AND** counter is an integer that persists in localStorage

### Requirement: Propagate trace ID through all system layers

The system SHALL pass the trace ID through every layer of the configuration save operation chain: UI provider → API client → HTTP request → backend handler → file operations.

#### Scenario: Trace ID passed from UI to API client
- **WHEN** `saveUserConfig` method is called with a generated trace ID
- **THEN** full trace ID string is passed to `writeFile` API function as a parameter (e.g., `AiSettings-1241`)
- **AND** trace ID is included in console log messages with `[traceId]` prefix (e.g., `[AiSettings-1241] saveUserConfig: Starting`)
- **AND** `writeFile` API extracts numeric counter from full trace ID string before making HTTP request

#### Scenario: Trace ID included in HTTP request
- **WHEN** `writeFile` API function makes HTTP POST request
- **THEN** numeric counter is extracted from full trace ID string using `parseInt(traceId.split('-')[1], 10)`
- **AND** numeric counter is included in HTTP header as `X-Trace-Id` (e.g., "1241")
- **AND** trace ID is NOT included in request body
- **AND** console logs show full trace ID for request and response (e.g., `[AiSettings-1241] writeFile: Writing to /path/to/file`)

#### Scenario: Trace ID extracted and used in backend
- **WHEN** backend receives POST /api/writeFile request
- **THEN** backend extracts numeric counter from `X-Trace-Id` header
- **AND** backend parses header value to integer using `parseInt(c.req.header('X-Trace-Id') || '0', 10)`
- **AND** backend includes counter in all pino log entries as structured field (number type)
- **AND** backend logs include the counter for correlation (e.g., `{"traceId": 1241, "level": "info", "msg": "Writing file", ...}`)

### Requirement: Maintain trace-aware logging format

The system SHALL include the trace ID in all log messages throughout the request lifecycle using consistent formats: `[traceId]` prefix with full `{event_name}-{counter}` format for UI console logs and numeric counter field for backend pino logs.

#### Scenario: UI console logs include trace ID prefix
- **WHEN** logging occurs in `saveUserConfig` or `writeFile` functions
- **THEN** each log message includes `[traceId]` prefix with full `{event_name}-{counter}` string
- **AND** format is: `[AppV2-1241] functionName: log message`

#### Scenario: Backend logs include trace ID counter as structured field
- **WHEN** logging occurs in backend file write operations
- **THEN** pino logger includes trace ID counter in structured data field (number type)
- **AND** log entries include: `{"traceId": 1241, "level": "info", "msg": "operation description", ...}`

#### Scenario: Logs enable end-to-end request correlation
- **WHEN** searching logs for a specific trace ID (e.g., `grep "AppV2-1241"` in UI logs, pino query for `traceId:1241` in backend logs)
- **THEN** all related log entries from UI console and backend logs are found
- **AND** log entries show complete request flow from start to finish

### Requirement: Support backward compatibility for trace ID

The system SHALL remain fully backward compatible when trace ID is not provided. All layers MUST handle missing trace ID gracefully.

#### Scenario: Backend handles missing trace ID
- **WHEN** POST /api/writeFile request has no trace ID in header or body
- **THEN** backend uses default value `0` for logging
- **AND** request processing continues without error
- **AND** log entries show `{"traceId": 0, ...}`

#### Scenario: Type definitions allow optional trace ID
- **WHEN** TypeScript code compiles
- **THEN** no changes to request body type definitions are required
- **AND** existing code remains valid
- **AND** no breaking changes to API contracts

### Requirement: HTTP header transport for trace ID

The system SHALL transport trace ID using HTTP header only (`X-Trace-Id`), keeping request body unchanged.

#### Scenario: Trace ID in HTTP header
- **WHEN** `writeFile` API makes HTTP request
- **THEN** `X-Trace-Id` header is set to the string representation of trace ID value (e.g., "42")
- **AND** backend parses header value to integer before use
- **AND** request body remains unchanged
